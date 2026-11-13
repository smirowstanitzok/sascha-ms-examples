// bin/app.ts
import { App } from 'aws-cdk-lib';
import { SpokeworksAgentStack } from '../lib/agent-stack';

const app = new App();
new SpokeworksAgentStack(app, 'SpokeworksAgentStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'eu-central-1' },
  modelId: app.node.tryGetContext('modelId') ?? 'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
});
