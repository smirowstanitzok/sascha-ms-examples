// bin/app.ts
import { App } from 'aws-cdk-lib';
import { PaymentWebhookStack } from '../lib/payment-webhook-stack.ts';

const app = new App();
new PaymentWebhookStack(app, 'RadwerkPaymentWebhook', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'eu-central-1' },
});
