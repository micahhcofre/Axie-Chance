#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AxieChanceStack } from '../lib/axie-chance-stack';

const app = new cdk.App();

new AxieChanceStack(app, 'AxieChanceStack', {
  description: 'Axie Chance web game hosted with S3 and CloudFront',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || '875412454463',
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});

