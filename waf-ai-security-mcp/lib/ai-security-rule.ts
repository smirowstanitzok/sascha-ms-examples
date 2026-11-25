// lib/ai-security-rule.ts
// Builds the WAF rule for the managed rule group AWSManagedRulesAISecurityRuleSet.
import type { Rule } from '@aws-sdk/client-wafv2';

export type Mode = 'observe' | 'enforce' | 'no-bedrock';

export const RULE_NAME = 'AI-Protection-MCP';

// Rules that block by default according to the docs. In "observe" mode they only count.
export const BLOCKING_RULES = [
  'Compliance_BaselineMCP',
  'Compliance_BaselineA2A',
  'Request_GuardrailsPromptAttackHighSeverity',
  'Response_GuardrailsPromptAttackHighSeverity',
];

export function buildAiSecurityRule(opts: {
  mode: Mode;
  roleArn?: string;
  pathPrefix: string;
  priority: number;
}): Rule {
  const { mode, roleArn, pathPrefix, priority } = opts;
  if (mode !== 'no-bedrock' && !roleArn) {
    throw new Error('For content checks, AWS WAF needs an IAM role (roleArn).');
  }

  const bedrockGuardrails =
    mode === 'no-bedrock'
      ? { Disable: {} }
      : { ProtectRequestAndResponse: { RoleArn: roleArn! } };

  const overrides =
    mode === 'observe'
      ? BLOCKING_RULES.map((Name) => ({ Name, ActionToUse: { Count: {} } }))
      : [];

  return {
    Name: RULE_NAME,
    Priority: priority,
    OverrideAction: { None: {} },
    Statement: {
      ManagedRuleGroupStatement: {
        VendorName: 'AWS',
        Name: 'AWSManagedRulesAISecurityRuleSet',
        ManagedRuleGroupConfigs: [{ AWSManagedRulesAISecurityRuleSet: { BedrockGuardrails: bedrockGuardrails } }],
        RuleActionOverrides: overrides.length ? overrides : undefined,
        // Only inspect MCP paths: saves fees and Bedrock calls
        ScopeDownStatement: {
          ByteMatchStatement: {
            FieldToMatch: { UriPath: {} },
            PositionalConstraint: 'STARTS_WITH',
            SearchString: new TextEncoder().encode(pathPrefix),
            TextTransformations: [{ Priority: 0, Type: 'NONE' }],
          },
        },
      },
    },
    VisibilityConfig: {
      SampledRequestsEnabled: true,
      CloudWatchMetricsEnabled: true,
      MetricName: RULE_NAME,
    },
  };
}
