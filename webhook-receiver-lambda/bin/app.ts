// bin/app.ts
import { App } from 'aws-cdk-lib';
import { WebhookInboxStack } from '../lib/webhook-inbox-stack.ts';

const app = new App();
new WebhookInboxStack(app, 'WebhookInboxStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'eu-central-1' },
});
