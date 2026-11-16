#!/usr/bin/env node
// bin/radverleih.ts
import * as cdk from 'aws-cdk-lib';
import { RadverleihApiStack, RadverleihDatenStack } from '../lib/radverleih-stack';

const app = new cdk.App();

// Account and region come from the active AWS profile
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const daten = new RadverleihDatenStack(app, 'RadverleihDaten', { env });
new RadverleihApiStack(app, 'RadverleihApi', { env, raederTabelle: daten.raederTabelle });
