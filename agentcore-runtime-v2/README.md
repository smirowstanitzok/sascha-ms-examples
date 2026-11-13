# AgentCore Runtime V2: snapshot-safe TypeScript agent

Example code for the article
**[AgentCore Runtime V2: avoid snapshot pitfalls](https://sascha-ms.de/en/agentcore-runtime-v2-snapshot-pitfalls)**
(German: [AgentCore Runtime V2: Snapshot-Fallen vermeiden](https://sascha-ms.de/2026/2848-agentcore-runtime-v2-snapshot)).

A small support agent for a fictional bike rental ("Spokeworks") that runs on
Amazon Bedrock AgentCore Runtime platform version V2, plus a static analysis
script that flags code which is unsafe across snapshot restores.

## Files

| Path | What it does |
| --- | --- |
| `agent/src/entropy.ts` | Snapshot-safe unique IDs from `/dev/urandom` (never `node:crypto`) |
| `agent/src/server.ts` | HTTP agent: `GET /ping`, `POST /invocations`, Bedrock Converse |
| `agent/data/faq.json` | The agent's knowledge base |
| `agent/Dockerfile` | Two-stage ARM64 image |
| `lib/agent-stack.ts` | CDK stack, `platformVersion: V2` set explicitly |
| `bin/app.ts` | CDK app entry point |
| `tools/snapshot-check.ts` | Scans source for snapshot-unsafe patterns, exit code 1 on findings |
| `test/snapshot-check.test.ts` | Tests for the scanner (`node:test`) |

## Run it

```bash
# install
npm install
cd agent && npm install && cd ..

# type-check, test, scan
npm run typecheck
npm test
npm run check:snapshot

# synth / deploy (needs a bootstrapped AWS account and an enabled Claude model)
npm run synth
npx cdk deploy SpokeworksAgentStack
```

## Checked versions

- Node.js 22
- `aws-cdk-lib` 2.276.0, `aws-cdk` 2.1148.1
- `typescript` 5.9.3
- `@aws-sdk/client-bedrock-runtime` 3.1168.x
