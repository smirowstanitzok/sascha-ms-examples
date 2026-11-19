// lib/agent-guardrails-stack.ts
import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export interface AgentGuardrailsProps extends StackProps {
  /** The only Region in which the agent may create or change resources. */
  allowedRegion: string;
  /** Receives the budget alerts. */
  budgetEmail: string;
  /** Monthly budget in US dollars. */
  monthlyBudgetUsd: number;
}

// Global services whose API calls are always routed through us-east-1.
const GLOBAL_SERVICES = [
  'iam:*', 'sts:*', 'organizations:*', 'account:*', 'budgets:*',
  'ce:*', 'cloudfront:*', 'route53:*', 'support:*', 'health:*',
  's3:ListAllMyBuckets',
];

// Actions the agent must never run through the AWS MCP Server.
// IAM does not accept a wildcard in the service prefix ('*:Delete*'), so list each service.
const DESTRUCTIVE_VIA_MCP = [
  's3:Delete*', 'dynamodb:Delete*', 'lambda:Delete*', 'logs:Delete*',
  'sqs:DeleteQueue', 'sns:DeleteTopic', 'events:Delete*', 'states:Delete*',
  'cloudformation:DeleteStack', 'ec2:Terminate*', 'rds:Delete*',
  'kms:ScheduleKeyDeletion', 'kms:DisableKey', 's3:PutBucketPolicy',
  'iam:Create*', 'iam:Put*', 'iam:Attach*', 'iam:Update*', 'iam:Delete*', 'iam:PassRole',
  'organizations:*', 'account:*',
];

export class AgentGuardrailsStack extends Stack {
  constructor(scope: Construct, id: string, props: AgentGuardrailsProps) {
    super(scope, id, props);

    // 1. A dedicated role for agent sessions instead of your admin login.
    const agentRole = new iam.Role(this, 'AgentDeveloperRole', {
      roleName: 'agent-developer',
      description: 'Used by AI coding agents (Claude Code, Codex, Kiro) via the AWS MCP Server',
      assumedBy: new iam.AccountPrincipal(this.account),
      maxSessionDuration: Duration.hours(1),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess')],
    });

    // 2. Deployments run through the CDK bootstrap roles, not through the agent role itself.
    agentRole.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowCdkBootstrapRoles',
      actions: ['sts:AssumeRole'],
      resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*`],
    }));

    // 3. Explicit denies always win. They apply only to calls made through the AWS MCP Server.
    agentRole.addToPolicy(new iam.PolicyStatement({
      sid: 'DenyDestructiveActionsViaMcp',
      effect: iam.Effect.DENY,
      actions: DESTRUCTIVE_VIA_MCP,
      resources: ['*'],
      conditions: { Bool: { 'aws:ViaAWSMCPService': 'true' } },
    }));

    // 4. Region lock: everything outside the allowed Region is denied (global services excepted).
    agentRole.addToPolicy(new iam.PolicyStatement({
      sid: 'DenyOtherRegions',
      effect: iam.Effect.DENY,
      notActions: GLOBAL_SERVICES,
      resources: ['*'],
      conditions: { StringNotEquals: { 'aws:RequestedRegion': props.allowedRegion } },
    }));

    // 5. Budget alarm: 80 % actual spend and 100 % forecast send an email.
    const notification = (threshold: number, type: 'ACTUAL' | 'FORECASTED') => ({
      notification: {
        notificationType: type,
        comparisonOperator: 'GREATER_THAN',
        threshold,
        thresholdType: 'PERCENTAGE',
      },
      subscribers: [{ subscriptionType: 'EMAIL', address: props.budgetEmail }],
    });

    new budgets.CfnBudget(this, 'AgentBudget', {
      budget: {
        budgetName: 'agent-sandbox-monthly',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: props.monthlyBudgetUsd, unit: 'USD' },
      },
      notificationsWithSubscribers: [notification(80, 'ACTUAL'), notification(100, 'FORECASTED')],
    });

    new CfnOutput(this, 'AgentRoleArn', { value: agentRole.roleArn });
  }
}
