import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';

export const DOMAIN = 'sindados.com.ar';

// Zona del dominio, aparte del sitio: hay que crearla primero, delegar en NIC.ar los
// servidores de nombre que salen acá (`NameServers`) y recién después desplegar el
// sitio, porque el certificado se valida por DNS y sin delegación se queda esperando.
// Es el único recurso con costo fijo del proyecto (0,50 USD/mes por zona).
export class AxieChanceDnsStack extends cdk.Stack {
  readonly zone: route53.PublicHostedZone;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.zone = new route53.PublicHostedZone(this, 'Zone', {
      zoneName: DOMAIN,
      comment: 'Axie Chance - sindados.com.ar',
    });
    // Si se borra la zona cambian los servidores de nombre y hay que volver a delegar
    // en NIC.ar: se conserva aunque se destruya el stack.
    this.zone.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    new cdk.CfnOutput(this, 'NameServers', {
      value: cdk.Fn.join(' ', this.zone.hostedZoneNameServers ?? []),
      description: 'Servidores de nombre para delegar sindados.com.ar en NIC.ar',
    });
    new cdk.CfnOutput(this, 'HostedZoneId', { value: this.zone.hostedZoneId });
  }
}
