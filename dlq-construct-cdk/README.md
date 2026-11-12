# Dead-letter queue with CDK: alarms and automatic redrive

A reusable AWS CDK construct (`QueueWithDlq`) that bundles an SQS source queue, a dead-letter queue, a parking queue for permanently broken messages, three CloudWatch alarms and an optional scheduled redrive via EventBridge Scheduler (universal target calling `sqs:startMessageMoveTask`). The example domain is a fictional bike rental.

- Article (English): https://sascha-ms.de/en/dead-letter-queue-cdk-redrive
- Article (German): https://sascha-ms.de/2026/2704-dead-letter-queue-mit-cdk

## Files

| File | Purpose |
| --- | --- |
| `lib/queue-with-dlq.ts` | The construct: queue, DLQ, parking queue, alarms, scheduled redrive |
| `lib/rental-stack.ts` | Example stack with a Lambda consumer and an SNS alarm topic |
| `src/return-consumer.ts` | Lambda consumer that separates transient from permanent errors |
| `bin/app.ts` | CDK app entry point |
| `test/queue-with-dlq.test.ts` | Template assertions for the construct (Vitest) |
| `test/return-consumer.test.ts` | Unit tests for the consumer |

## Run

```bash
npm install
npx tsc --noEmit
npx vitest run
npx cdk synth
```

Deploying (`npx cdk deploy`) needs AWS credentials and a bootstrapped account. Remove the stack with `npx cdk destroy` after testing: the fictional billing API does not exist, so valid test messages keep cycling between queue and DLQ.

## Tested with

aws-cdk-lib 2.276.0, aws-cdk (CLI) 2.1148.1, TypeScript 7.0.2, Vitest 5.1.0, Node.js 22.
