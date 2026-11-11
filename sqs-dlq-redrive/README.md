# SQS dead-letter queue: alarm, triage and redrive

Example code for the article:

- English: [SQS dead-letter queue: alarm, triage and redrive](https://sascha-ms.de/en/sqs-dead-letter-queue-redrive/)
- German: [SQS Dead-Letter-Queue: Alarm, Analyse und Redrive](https://sascha-ms.de/2026/2646-sqs-dead-letter-queue-redrive/)

A fictional ticket shop puts orders into an SQS queue. A Lambda function issues tickets via an external API.
Failed messages land in a dead-letter queue (DLQ) after five receives, a CloudWatch alarm fires, and two scripts
help you inspect the DLQ and redrive it in a controlled way.

## Files

| File | Purpose |
| --- | --- |
| `serverless.yml` | Queue, DLQ (14 days retention), SNS topic, two CloudWatch alarms, Lambda with partial batch response |
| `src/order.ts` | Validates an order; permanent errors throw `InvalidOrderError` |
| `src/handler.ts` | SQS handler that reports only failed messages (`batchItemFailures`) |
| `scripts/dlq-peek.ts` | Reads DLQ messages without deleting them, groups them by cause, masks email addresses |
| `scripts/dlq-redrive.ts` | Starts a throttled redrive with `StartMessageMoveTask`, shows progress, cancels on Ctrl+C |
| `test/handler.test.ts` | Vitest unit tests |

## Run

```bash
npm install
npm run typecheck
npm test
serverless deploy --stage dev --param="alertEmail=you@example.com"

# after an alarm
npx tsx scripts/dlq-peek.ts <DlqUrl>
npx tsx scripts/dlq-redrive.ts <DlqArn> 5
```

Tested with Node.js 22, TypeScript 5.9, Vitest 4.1, @aws-sdk/client-sqs 3.1166 and Serverless Framework v4 (runtime `nodejs24.x`).
Deploying creates AWS resources that may incur (small) costs. Remove them with `serverless remove --stage dev`.
