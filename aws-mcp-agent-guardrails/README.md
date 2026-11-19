# AWS MCP Server: connect AI agents to AWS safely

Example code for the article
[AWS MCP Server: Connect AI Agents to AWS Safely](https://sascha-ms.de/en/aws-mcp-server-ai-agents-guardrails)
(German version: [AWS MCP Server: KI-Agenten sicher mit AWS verbinden](https://sascha-ms.de/2026/3695-aws-mcp-server-ki-agenten-absichern)).

Guardrails for AI coding agents (Claude Code, Codex, Kiro, …) that work in your AWS account through the
AWS MCP Server: a scoped `agent-developer` role, a deny rule for calls made through the MCP server
(`aws:ViaAWSMCPService`), a region lock and a monthly budget alarm, built with AWS CDK.
The scenario is a fictional online bookshop.

## Files

| File | Purpose |
| --- | --- |
| `lib/agent-guardrails-stack.ts` | CDK stack: agent role, MCP deny rule, region lock, budget alarm |
| `bin/app.ts` | CDK app entry point, reads Region, email and budget from `cdk.json` |
| `test/agent-guardrails.test.ts` | Tests for the guardrails (Node.js test runner + CDK assertions) |
| `cdk.json` | CDK app config and context values |
| `config/add-aws-mcp.sh` | Registers the AWS MCP Server (Frankfurt) in Claude Code with the `agent` profile |
| `config/aws-config.example.ini` | Example `~/.aws/config` profiles `dev` and `agent` |
| `config/CLAUDE.md.example` | Project rules for the agent |
| `config/claude-settings.example.json` | Example `.claude/settings.json` with approvals |

## Run it

```bash
npm install
npx tsc --noEmit -p .
npm test
npx cdk synth

# deploy yourself, not through the agent (needs AWS credentials)
aws login --profile dev
npx cdk bootstrap --profile dev
npx cdk deploy --profile dev
```

Set your email address in `cdk.json` before deploying. The role and policies are free;
the agent's resources are not, so keep the budget alarm.

## Tested with

Node.js 22, TypeScript 7.0, aws-cdk-lib 2.277.0, aws-cdk 2.1149.0, tsx 4.23 (typecheck, tests and `cdk synth`).
Deployment and the MCP server connection need an AWS account and were not run in CI.
