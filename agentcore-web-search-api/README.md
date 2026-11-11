# AgentCore Web Search API: a research agent with Lambda and CDK

Example code for the article:

- English: [AgentCore Web Search API: web search without a gateway](https://sascha-ms.de/en/agentcore-web-search-api)
- German: [AgentCore Web Search API: Websuche ohne Gateway](https://sascha-ms.de/2026/2659-agentcore-web-search-api)

A small research Lambda for a fictional bookshop. It runs an agent loop with Bedrock Converse, lets the model request searches through a `web_search` tool, calls `InvokeWebSearch` on Amazon Bedrock AgentCore with a fixed list of trusted domains, and returns the answer together with a numbered source list. A search budget (default: three searches per question) caps the search costs.

## Files

| File | Purpose |
| --- | --- |
| `src/web-search.ts` | Wraps `InvokeWebSearch`: validates limits, normalizes domains, maps results to sources |
| `src/agent.ts` | Agent loop with Bedrock Converse, search budget and numbered sources |
| `src/handler.ts` | Lambda handler, reads model ID and trusted domains from environment variables |
| `lib/research-stack.ts` | CDK stack: Node.js 24 Lambda on arm64, bundled SDK, least-privilege IAM |
| `bin/app.ts` | CDK app, deploys to `eu-west-1` (the only EU region with the API at launch) |
| `test/*.test.ts` | Vitest tests for the search client, the agent loop and the stack template |

## Run

```bash
npm install
npm run typecheck
npm test
npm run synth
```

No AWS account is needed for tests and synth. `npx cdk deploy` requires AWS credentials, a bootstrapped account in `eu-west-1` and access to the Bedrock model (default: `eu.anthropic.claude-haiku-4-5-20251001-v1:0`, override with `-c modelId=...`).

```bash
aws lambda invoke --region eu-west-1 --function-name <FunctionName> \
  --cli-binary-format raw-in-base64-out \
  --payload '{"question":"Which Node.js versions does AWS Lambda currently support?"}' answer.json
```

Tested with Node.js 22, @aws-sdk/client-bedrock-agentcore 3.1166.0, aws-cdk-lib 2.276.0, aws-cdk 2.1148.0, Vitest 5.1.0 and TypeScript 7.0.2 (12 tests green, `tsc --noEmit` without errors, `cdk synth` successful). Not deployed.
