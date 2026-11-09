# Receiving webhooks with Lambda: signatures, duplicates, SQS

Example code for the article:

- English: [Receiving webhooks with Lambda: signatures, duplicates, SQS](https://sascha-ms.de/en/receiving-webhooks-lambda)
- German: [Webhooks empfangen mit Lambda: Signatur, Duplikate, SQS](https://sascha-ms.de/2026/1574-webhooks-empfangen-lambda)

A Lambda function behind a function URL verifies Standard Webhooks signatures (HMAC-SHA256 over the raw body, 5-minute timestamp tolerance), detects duplicates with a conditional DynamoDB write, puts the payload on an SQS queue and answers `202` right away. A worker function processes the queue with partial batch responses and a dead-letter queue. The fictional domain is a bike rental receiving payment events.

## Files

| File | Purpose |
| --- | --- |
| `src/signature.ts` | Signature and timestamp verification (Standard Webhooks format) |
| `src/secret.ts` | Reads the webhook secret from SSM Parameter Store and caches it |
| `src/receiver.ts` | Function URL handler: verify, deduplicate, enqueue, reply 202 |
| `src/worker.ts` | SQS consumer with idempotency check and `batchItemFailures` |
| `lib/webhook-inbox-stack.ts` | AWS CDK stack: table with TTL, queue + DLQ, two functions, function URL |
| `bin/app.ts` | CDK app entry point |
| `test/signature.test.ts` | Unit tests for the signature check (`node:test`) |
| `scripts/send-test-webhook.ts` | Sends a signed test webhook to your deployed URL |

## Run it

```bash
npm install
npm test            # unit tests, no AWS credentials needed
npx tsc --noEmit    # type check

# create the shared secret once
SECRET="whsec_$(openssl rand -base64 32)"
aws ssm put-parameter --name /radstation/webhooks/payment-secret --type SecureString --value "$SECRET"

npx cdk deploy      # prints WebhookInboxStack.WebhookUrl

export WEBHOOK_URL="https://<id>.lambda-url.<region>.on.aws/"
export WEBHOOK_SECRET="$SECRET"
npx tsx scripts/send-test-webhook.ts msg_test_001   # 202 accepted
npx tsx scripts/send-test-webhook.ts msg_test_001   # 200 duplicate
```

`cdk destroy` removes everything except the SSM parameter (`aws ssm delete-parameter --name /radstation/webhooks/payment-secret`).

## Tested with

Node.js 22, TypeScript 5.9.3, aws-cdk-lib 2.275.0, aws-cdk 2.1147.0, AWS SDK for JavaScript v3.1161, Lambda runtime `nodejs24.x` (arm64). `npm test`, `tsc --noEmit` and `cdk synth` were run; the deployment itself was not tested in an AWS account.
