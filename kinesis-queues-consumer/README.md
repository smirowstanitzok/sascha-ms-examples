# Kinesis Data Streams queues: ticket mailer worker

Example code for the article **“Kinesis Data Streams queues: workers without shard leases”**

- English: https://sascha-ms.de/en/kinesis-data-streams-queues
- German: https://sascha-ms.de/2026/3626-kinesis-data-streams-queues

A fictional ticket shop writes every sale to an on-demand Kinesis data stream. A Kinesis queue (`ticket-mailer`) hands the records to Fargate workers that send exactly one ticket email per order, using a DynamoDB lease for idempotency. Failed records are retried with backoff and end up in the queue's built-in dead-letter state after five attempts.

## Files

| File | Purpose |
| --- | --- |
| `src/queue-worker.ts` | Generic receive loop: long polling, partial acknowledgment, retry backoff via visibility timeout, clean shutdown |
| `src/idempotency.ts` | DynamoDB claim/complete/release with a lease |
| `src/ticket-mailer.ts` | Business handler: decode the sale and send the email once |
| `src/main.ts` | Entry point for the container |
| `test/*.test.ts` | Vitest tests with `aws-sdk-client-mock` |
| `infra/lib/ticket-queue-stack.ts` | AWS CDK stack: on-demand stream, queue via `AwsCustomResource`, DynamoDB table, Fargate service scaled on `VisibleQueueRecords`, dead-letter alarm |
| `Dockerfile` | Multi-stage image for the worker |

## Run

```bash
npm install
npm test          # 10 tests
npx tsc --noEmit
npx cdk synth
npx cdk deploy    # needs Docker and AWS credentials
```

Then write a test sale:

```bash
aws kinesis put-record --stream-name ticket-sales --partition-key A-1001 \
  --cli-binary-format raw-in-base64-out \
  --data '{"orderId":"A-1001","eventName":"Jazz in the park","email":"fan@example.com","seats":2}'
```

## Notes

- At launch, CloudFormation has no resource type for Kinesis queues, so the stack creates the queue with `AwsCustomResource` (`installLatestAwsSdk: true`).
- The stream is retained on `cdk destroy`, because `DeleteStream` fails while a queue is still being deleted. Delete it manually afterwards.
- Check in CloudWatch that the `QueueId` dimension matches the ID at the end of the queue ARN before relying on the scaling policy.
- Costs: on-demand stream hourly fee, Fargate task running 24/7, public IPv4 address, DynamoDB on demand.

Tested with: Node.js 22, TypeScript 5.9, `@aws-sdk/client-kinesis` 3.1171.0, `aws-cdk-lib` 2.277.0, Vitest 3.2. Unit tests and `cdk synth` only; not deployed in a live account.
