// infra/bin/app.ts
import { App } from 'aws-cdk-lib';
import { TicketQueueStack } from '../lib/ticket-queue-stack.js';

const app = new App();
new TicketQueueStack(app, 'TicketQueueStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'eu-central-1' },
});
