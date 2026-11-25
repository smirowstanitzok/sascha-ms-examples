# AWS WAF AI Security in front of an MCP server on Lambda

Example code for the article:

- English: [AWS WAF AI Security: Protect MCP Servers with Guardrails](https://sascha-ms.de/en/aws-waf-ai-security-mcp-servers/)
- German: [AWS WAF AI Security: MCP-Server mit Guardrails schützen](https://sascha-ms.de/2026/4021-aws-waf-ai-security-mcp-server/)

A minimal, stateless MCP server (Streamable HTTP, JSON responses) for a fictional city library runs on AWS Lambda behind an API Gateway REST API. A web ACL with a rate limit protects the API. A script adds the managed rule group `AWSManagedRulesAISecurityRuleSet` with Bedrock Guardrails content checks, because CloudFormation/CDK don't support its configuration yet (as of 2026-11-25).

## Files

| File | Purpose |
| --- | --- |
| `lambda/mcp-handler.ts` | MCP server with one tool, `search_books` |
| `lib/library-search-stack.ts` | CDK stack: Lambda, REST API, web ACL, IAM role for AWS WAF, CloudWatch alarm on `guardrails:call_failed` |
| `lib/ai-security-rule.ts` | Builds the AI Security rule (modes `observe`, `enforce`, `no-bedrock`) |
| `scripts/ai-security.ts` | Adds/updates the rule in the web ACL via `UpdateWebACL` |
| `scripts/probe.ts` | Sends a harmless and a malicious `tools/call` |
| `test/*.test.ts` | Unit tests with the Node.js test runner |

## Run

```bash
npm install
npm test
npx cdk bootstrap aws://<account-id>/eu-north-1   # first time only
npm run deploy                                    # cdk deploy + rule in "observe" mode
npm run probe -- https://<api-id>.execute-api.eu-north-1.amazonaws.com/prod/mcp
npx tsx scripts/ai-security.ts enforce            # switch to blocking
```

`npm run deploy` re-applies the rule after every deployment, because CloudFormation replaces the rule list of the web ACL. Use `MODE=enforce npm run deploy` to stay in enforcing mode.

Notes:

- AI Security is available in us-east-1, us-east-2, us-west-2, eu-west-2, eu-north-1, ap-northeast-1 and ap-southeast-2 (not in eu-central-1).
- AWS WAF charges an extra fee per evaluated request; Bedrock Guardrails checks are billed to your account. Delete the stack with `npx cdk destroy` when you are done.

## Tested with

Node.js 22, TypeScript 5.9, aws-cdk-lib 2.278.0, aws-cdk 2.1149.0, @aws-sdk/client-wafv2 3.1177.0 (`tsc --noEmit`, `node --test`, `cdk synth`). Not deployed in this test run.
