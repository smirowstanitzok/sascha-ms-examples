// bin/app.ts
import { App } from 'aws-cdk-lib';
import { BikeSiteStack } from '../lib/bike-site-stack.js';

const app = new App();
new BikeSiteStack(app, 'BikeSiteStack', {
  // EdgeFunction needs an explicit region; the edge function itself lands in us-east-1
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'eu-central-1' }
});
