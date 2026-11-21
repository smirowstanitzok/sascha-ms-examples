// bin/app.ts
import { App } from 'aws-cdk-lib';
import { LiveTickerStack } from '../lib/live-ticker-stack.ts';

const app = new App();
// Account and Region come from your AWS profile (e.g. AWS_REGION=eu-central-1).
new LiveTickerStack(app, 'LiveTickerStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
