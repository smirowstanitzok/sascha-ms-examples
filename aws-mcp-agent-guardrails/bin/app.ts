// bin/app.ts
import { App } from 'aws-cdk-lib';
import { AgentGuardrailsStack } from '../lib/agent-guardrails-stack.ts';

const app = new App();

new AgentGuardrailsStack(app, 'AgentGuardrails', {
  allowedRegion: app.node.tryGetContext('allowedRegion') ?? 'eu-central-1',
  budgetEmail: app.node.tryGetContext('budgetEmail') ?? 'you@example.com',
  monthlyBudgetUsd: Number(app.node.tryGetContext('monthlyBudgetUsd') ?? 20),
  env: { region: app.node.tryGetContext('allowedRegion') ?? 'eu-central-1' },
});
