#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AxieChanceDnsStack } from '../lib/dns-stack';
import { AxieChanceStack } from '../lib/axie-chance-stack';

const app = new cdk.App();

// La cuenta sale del perfil con el que se despliega (`--profile axie-chance`). La
// región es fija: CloudFront solo acepta certificados de us-east-1.
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' };

// Orden: primero la zona (`npm run deploy:dns`), delegar en NIC.ar, después el sitio.
const dns = new AxieChanceDnsStack(app, 'AxieChanceDnsStack', {
  description: 'Axie Chance DNS zone for sindados.com.ar',
  env,
});

new AxieChanceStack(app, 'AxieChanceStack', {
  description: 'Axie Chance web game hosted with S3 and CloudFront',
  env,
  zone: dns.zone,
});
