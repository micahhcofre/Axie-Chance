import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

// Dominio propio: la zona ya existe en Route 53 y NIC.ar delega en sus servidores.
const DOMAIN = 'sindados.com.ar';
const HOSTED_ZONE_ID = 'Z00867837XAO55UM8W17';
const SITE_NAMES = [DOMAIN, `www.${DOMAIN}`];

export class AxieChanceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Private S3 bucket for website assets
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 2. Certificado del dominio, validado por DNS en la misma zona. CloudFront solo
    //    acepta certificados de us-east-1, que es la región del stack.
    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: HOSTED_ZONE_ID,
      zoneName: DOMAIN,
    });
    const certificate = new acm.Certificate(this, 'SiteCertificate', {
      domainName: DOMAIN,
      subjectAlternativeNames: [`www.${DOMAIN}`],
      validation: acm.CertificateValidation.fromDns(zone),
    });

    // 3. CloudFront Distribution with Origin Access Control (OAC)
    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      domainNames: SITE_NAMES,
      certificate,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      defaultRootObject: 'index.html',
      comment: 'Axie Chance web game distribution',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(1),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(1),
        },
      ],
    });

    // 4. El dominio y www apuntan a CloudFront (A e IPv6). `deleteExisting` borra los
    //    registros A que apuntaban al servidor EC2 armado a mano.
    SITE_NAMES.forEach((name, i) => {
      const id = i === 0 ? 'Apex' : 'Www';
      const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution));
      const record = new route53.ARecord(this, `${id}A`, { zone, recordName: name, target, deleteExisting: true });
      cdk.Annotations.of(record).acknowledgeWarning('@aws-cdk/aws-route53:deleteExisting', 'Reemplaza a propósito los registros del EC2');
      new route53.AaaaRecord(this, `${id}Aaaa`, { zone, recordName: name, target });
    });

    // 5. Relay de las salas en red (ver relay/core.mjs). La partida corre en el
    //    navegador de quien crea la sala; esto solo lleva mensajes entre las pantallas.
    //    Todo se paga por uso: sin partidas no hay nada prendido ni nada que cobrar.
    const projectRoot = path.resolve(__dirname, '../../');

    const roomsTable = new dynamodb.Table(this, 'RoomsTable', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expires',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const relayLogs = new logs.LogGroup(this, 'RelayLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const relayFn = new lambda.Function(this, 'RelayFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'lambda.handler',
      code: lambda.Code.fromAsset(path.join(projectRoot, 'relay')),
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: { TABLE: roomsTable.tableName },
      logGroup: relayLogs,
      description: 'Axie Chance room relay - forwards messages between players',
    });
    roomsTable.grantReadWriteData(relayFn);

    // Una integración por ruta: cada una trae su propio permiso para invocar la Lambda,
    // y compartir la misma dejaba permiso solo para $connect.
    const relayApi = new apigwv2.WebSocketApi(this, 'RelayApi', {
      apiName: 'axie-chance-relay',
      description: 'Axie Chance room relay',
      connectRouteOptions: { integration: new WebSocketLambdaIntegration('RelayConnect', relayFn) },
      disconnectRouteOptions: { integration: new WebSocketLambdaIntegration('RelayDisconnect', relayFn) },
      defaultRouteOptions: { integration: new WebSocketLambdaIntegration('RelayDefault', relayFn) },
    });
    // Tope de mensajes por segundo para toda la API: una partida manda unos pocos, y el
    // tope evita que un abuso se convierta en una factura.
    const relayStage = new apigwv2.WebSocketStage(this, 'RelayStage', {
      webSocketApi: relayApi,
      stageName: 'net',
      autoDeploy: true,
      throttle: { rateLimit: 50, burstLimit: 100 },
    });
    relayApi.grantManageConnections(relayFn);

    // 6. Deploy website assets to S3 and invalidate CloudFront cache

    new s3deploy.BucketDeployment(this, 'DeploySite', {
      sources: [
        s3deploy.Source.asset(projectRoot, {
          exclude: [
            'infra',
            'infra/**',
            'node_modules',
            'node_modules/**',
            '.git',
            '.git/**',
            '.cache',
            '.cache/**',
            'test',
            'test/**',
            'scripts',
            'scripts/**',
            'relay',
            'relay/**',
            'net.json',
            '*.md',
            'package.json',
            'package-lock.json',
            '.DS_Store',
            '.gitignore',
            '.gitattributes',
          ],
        }),
        // Dónde está el relay: la página lo lee al entrar a la partida en red (ver
        // `netAvailable` en src/net.js).
        s3deploy.Source.jsonData('net.json', { ws: relayStage.url }),
      ],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
      prune: true,
    });

    // 7. Stack Outputs
    new cdk.CfnOutput(this, 'RelayUrl', {
      value: relayStage.url,
      description: 'WebSocket URL of the room relay',
    });

    new cdk.CfnOutput(this, 'GameUrl', {
      value: `https://${DOMAIN}`,
      description: 'URL of the deployed Axie Chance game',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: siteBucket.bucketName,
      description: 'S3 Bucket holding the game files',
    });
  }
}

