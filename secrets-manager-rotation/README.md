# Secrets Manager rotation with Lambda for API keys

Custom AWS Secrets Manager rotation function in TypeScript that rotates an API key at a (fictional) partner lock API without downtime. Deployed with the Serverless Framework v4, including rotation schedule and a failure alarm via EventBridge and SNS.

- Article (English): https://sascha-ms.de/en/secrets-manager-rotation-lambda-api-keys
- Artikel (Deutsch): https://sascha-ms.de/2026/1724-secrets-manager-rotation-lambda

## Files

| File | Purpose |
| --- | --- |
| `src/rotate.ts` | Rotation function with the four steps createSecret, setSecret, testSecret, finishSecret |
| `src/lock-partner-client.ts` | HTTP client for the fictional partner lock API (two active keys) |
| `src/lock-key-cache.ts` | How a regular Lambda function reads the rotated key (cache + retry on 401) |
| `test/rotate.test.ts` | Unit tests with Vitest and aws-sdk-client-mock |
| `serverless.yml` | Function, invoke permission, rotation schedule, EventBridge alarm |

## Run

```bash
npm install
npm run typecheck
npm test
```

Deploy (needs AWS credentials and a real partner API; `api.lockpartner.example` is a placeholder):

```bash
aws secretsmanager create-secret --name bike-rental/lock-api \
  --secret-string '{"baseUrl":"https://api.lockpartner.example","accountId":"rental-42","keyId":"start","apiKey":"<initial key>"}'
serverless deploy
```

## Tested with

Node.js 22, TypeScript 5.9, Vitest 3.2, @aws-sdk/client-secrets-manager 3.1161, aws-sdk-client-mock 4.1. Lambda runtime: nodejs24.x.
