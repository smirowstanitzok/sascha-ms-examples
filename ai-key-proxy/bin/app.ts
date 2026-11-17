// bin/app.ts
import { App } from 'aws-cdk-lib';
import { BookAdvisorStack } from '../lib/book-advisor-stack.js';

const app = new App();
new BookAdvisorStack(app, 'BookAdvisorStack', {
  // Region matching the EU inference profile
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'eu-central-1' },
  modelId: app.node.tryGetContext('modelId'),
  dailyTokenLimit: Number(app.node.tryGetContext('dailyTokenLimit')),
  alarmTokensPerHour: Number(app.node.tryGetContext('alarmTokensPerHour')),
});
