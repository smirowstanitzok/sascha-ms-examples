// test/ai-security-rule.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAiSecurityRule, BLOCKING_RULES } from '../lib/ai-security-rule';

const ROLE = 'arn:aws:iam::111122223333:role/waf-bedrock';

test('observe mode sets all blocking rules to Count', () => {
  const r = buildAiSecurityRule({ mode: 'observe', roleArn: ROLE, pathPrefix: '/prod/mcp', priority: 20 });
  const mrg = r.Statement!.ManagedRuleGroupStatement!;
  assert.equal(mrg.Name, 'AWSManagedRulesAISecurityRuleSet');
  assert.deepEqual(mrg.RuleActionOverrides!.map((o) => o.Name), BLOCKING_RULES);
  assert.equal(
    mrg.ManagedRuleGroupConfigs![0].AWSManagedRulesAISecurityRuleSet!.BedrockGuardrails!.ProtectRequestAndResponse!.RoleArn,
    ROLE,
  );
});

test('enforce mode keeps the default actions', () => {
  const r = buildAiSecurityRule({ mode: 'enforce', roleArn: ROLE, pathPrefix: '/prod/mcp', priority: 20 });
  assert.equal(r.Statement!.ManagedRuleGroupStatement!.RuleActionOverrides, undefined);
});

test('no-bedrock needs no role', () => {
  const r = buildAiSecurityRule({ mode: 'no-bedrock', pathPrefix: '/prod/mcp', priority: 20 });
  assert.deepEqual(
    r.Statement!.ManagedRuleGroupStatement!.ManagedRuleGroupConfigs![0].AWSManagedRulesAISecurityRuleSet!.BedrockGuardrails,
    { Disable: {} },
  );
});

test('content checks without a role throw an error', () => {
  assert.throws(() => buildAiSecurityRule({ mode: 'enforce', pathPrefix: '/prod/mcp', priority: 20 }));
});
