// test/agent-guardrails.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AgentGuardrailsStack } from '../lib/agent-guardrails-stack.ts';

const template = Template.fromStack(new AgentGuardrailsStack(new App(), 'Test', {
  allowedRegion: 'eu-central-1',
  budgetEmail: 'team@example.com',
  monthlyBudgetUsd: 20,
  env: { account: '111111111111', region: 'eu-central-1' },
}));

test('agent role has read-only access and a one-hour session limit', () => {
  template.hasResourceProperties('AWS::IAM::Role', {
    RoleName: 'agent-developer',
    MaxSessionDuration: 3600,
    ManagedPolicyArns: Match.arrayWith([
      Match.objectLike({ 'Fn::Join': Match.arrayWith([Match.arrayWith([':iam::aws:policy/ReadOnlyAccess'])]) }),
    ]),
  });
});

test('destructive actions are denied when called through the AWS MCP Server', () => {
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Sid: 'DenyDestructiveActionsViaMcp',
          Effect: 'Deny',
          Condition: { Bool: { 'aws:ViaAWSMCPService': 'true' } },
        }),
      ]),
    },
  });
});

test('requests outside the allowed Region are denied', () => {
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Sid: 'DenyOtherRegions',
          Effect: 'Deny',
          Condition: { StringNotEquals: { 'aws:RequestedRegion': 'eu-central-1' } },
        }),
      ]),
    },
  });
});

test('budget sends two email notifications', () => {
  const budgets = template.findResources('AWS::Budgets::Budget');
  const [budget] = Object.values(budgets);
  assert.equal(budget.Properties.Budget.BudgetLimit.Amount, 20);
  assert.equal(budget.Properties.NotificationsWithSubscribers.length, 2);
});
