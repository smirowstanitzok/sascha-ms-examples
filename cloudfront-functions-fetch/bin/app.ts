// bin/app.ts
import { App } from 'aws-cdk-lib';
import { AgentGateStack } from '../lib/agent-gate-stack.ts';

const app = new App();
new AgentGateStack(app, 'AgentGateStack', {
  env: { region: process.env.CDK_DEFAULT_REGION ?? 'eu-central-1' },
});
