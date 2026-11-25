// scripts/ai-security.ts
// Usage: npx tsx scripts/ai-security.ts observe|enforce|no-bedrock
import { GetWebACLCommand, UpdateWebACLCommand, WAFV2Client } from '@aws-sdk/client-wafv2';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { buildAiSecurityRule, Mode, RULE_NAME } from '../lib/ai-security-rule';

const REGION = 'eu-north-1';
const mode = (process.argv[2] ?? 'observe') as Mode;

async function stackOutputs(): Promise<Record<string, string>> {
  const cfn = new CloudFormationClient({ region: REGION });
  const { Stacks } = await cfn.send(new DescribeStacksCommand({ StackName: 'LibrarySearchStack' }));
  return Object.fromEntries((Stacks?.[0]?.Outputs ?? []).map((o) => [o.OutputKey!, o.OutputValue!]));
}

async function main() {
  if (!['observe', 'enforce', 'no-bedrock'].includes(mode)) {
    throw new Error(`Unknown mode: ${mode}`);
  }
  const out = await stackOutputs();
  const waf = new WAFV2Client({ region: REGION });
  const target = { Name: out.WebAclName, Id: out.WebAclId, Scope: 'REGIONAL' as const };

  const { WebACL, LockToken } = await waf.send(new GetWebACLCommand(target));
  if (!WebACL || !LockToken) throw new Error('Web ACL not found');

  const otherRules = (WebACL.Rules ?? []).filter((r) => r.Name !== RULE_NAME);
  const newRule = buildAiSecurityRule({
    mode,
    roleArn: out.WafRoleArn,
    pathPrefix: '/prod/mcp',
    priority: 20,
  });

  await waf.send(
    new UpdateWebACLCommand({
      ...target,
      LockToken,
      DefaultAction: WebACL.DefaultAction,
      VisibilityConfig: WebACL.VisibilityConfig,
      Rules: [...otherRules, newRule],
    }),
  );
  console.log(`AI Security active in mode "${mode}" for ${out.WebAclName}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
