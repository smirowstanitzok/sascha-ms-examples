// bin/app.ts
import * as cdk from 'aws-cdk-lib';
import { BikeRentalApiStack } from '../lib/bike-rental-api-stack';

const app = new cdk.App();
new BikeRentalApiStack(app, 'BikeRentalApi', {
  env: { region: process.env.CDK_DEFAULT_REGION ?? 'eu-central-1' },
});
