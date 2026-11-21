# CloudFront Functions fetch: check AI agents at the edge

A CloudFront Function uses `cf.fetch()` to ask a small check service (Lambda function URL behind OAC) whether an AI agent may call the API. The check service verifies token, scope and daily budget in DynamoDB with a single atomic `UpdateItem`. Only verified requests reach the bike rental API.

- Article (English): https://sascha-ms.de/en/cloudfront-functions-fetch
- Artikel (Deutsch): https://sascha-ms.de/2026/3861-cloudfront-functions-fetch

## Files

| File | Purpose |
| --- | --- |
| `edge/agent-gate.js` | CloudFront Function (runtime 2.0, viewer request) with `cf.fetch()` |
| `edge/block-internal.js` | Blocks outside access to the check service behavior |
| `src/agent-rules.ts` | Pure rules: scope, usage key, denial reason |
| `src/check-agent.ts` | Check service: atomic check and count in DynamoDB |
| `src/bike-api.ts` | Sample API behind CloudFront |
| `lib/agent-gate-stack.ts` | AWS CDK stack (DynamoDB, Lambda, function URLs with OAC, CloudFront) |
| `bin/app.ts` | CDK app |
| `test/*.test.ts` | Tests with `node:test`, no AWS account needed |

## Run

```bash
npm install
npm run typecheck
npm test
npx cdk synth
npx cdk deploy   # needs AWS credentials and a bootstrapped account
```

Create a test agent and call the API as described in the article. Clean up with `npx cdk destroy`.

Note: network calls are not available on the CloudFront free flat-rate plan. The CDK default (pay-as-you-go) works.

## Tested with

Node.js 22.23, TypeScript 5.9, aws-cdk-lib 2.278.0, aws-cdk 2.1149.0, AWS SDK for JavaScript v3.
