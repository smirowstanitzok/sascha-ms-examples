# Protecting AI API keys: a Bedrock proxy with per-user quotas

A small backend for a fictional bookshop ("book advisor") that keeps the AI provider key out of the browser: a Cognito-protected HTTP API calls Amazon Bedrock through a Lambda function, enforces a daily token quota per user in DynamoDB and raises a CloudWatch alarm when token usage spikes. Plus a script that scans build output for leaked keys.

- Article (English): [Protecting AI API keys: lessons from ARTEX](https://sascha-ms.de/en/protecting-ai-api-keys)
- Article (German): [KI-API-Keys schützen: Lehren aus der ARTEX-Kampagne](https://sascha-ms.de/2026/3460-ki-api-keys-schuetzen)

## Files

| File | Purpose |
| --- | --- |
| `bin/app.ts` | CDK app (region `eu-central-1`, values from `cdk.json` context) |
| `lib/book-advisor-stack.ts` | Cognito user pool, HTTP API with JWT authorizer, Lambda, DynamoDB quota table, alarm |
| `src/chat-handler.ts` | Lambda handler: validates the request, reserves tokens, calls Bedrock Converse |
| `src/request.ts` | Input checks and token estimate |
| `src/quota.ts` | Daily token quota per user with conditional DynamoDB updates |
| `src/provider-key.ts` | Optional: reads a third-party provider key from SSM Parameter Store (SecureString) |
| `scripts/scan-secrets.ts` | Scans a folder (e.g. `dist` or `cdk.out`) for strings that look like API keys |

## Run it

```bash
npm install
npm run typecheck
npx cdk synth
npx tsx scripts/scan-secrets.ts cdk.out
```

Deploying (`npx cdk deploy`) creates real resources (Cognito, API Gateway, Lambda, DynamoDB, CloudWatch) and Bedrock calls cost money. The test user commands are in the article. Remove everything afterwards with `npx cdk destroy`.

## Tested with

Node.js 22, TypeScript 5.9, aws-cdk-lib 2.277, AWS SDK v3.1170 (type check and `cdk synth`).
