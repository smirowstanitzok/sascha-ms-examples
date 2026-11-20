# Lambda 30 minute timeout: SQS worker with checkpoint and continuation

Example code for the article **Lambda 30 minute timeout: what to check now**

- English: https://sascha-ms.de/en/lambda-30-minute-timeout
- German: https://sascha-ms.de/2026/3792-lambda-30-minuten-timeout

A fictional photo book print shop renders orders page by page. The Lambda function uses the new 30-minute timeout, checks its remaining time before every page, stores a checkpoint in DynamoDB and puts a continuation message back into the SQS queue before the timeout hits.

## Files

| File | Purpose |
| --- | --- |
| `serverless.yml` | Infrastructure with the Serverless Framework v4 (queue with 3 h visibility timeout, DLQ, DynamoDB table, function with `timeout: 1800`) |
| `cdk/lib/photo-book-stack.ts`, `cdk/bin/app.ts` | The same infrastructure with AWS CDK |
| `src/render-photobook.ts` | Handler logic with time budget, checkpoint and continuation |
| `src/checkpoint-store.ts` | Checkpoint interface and in-memory implementation |
| `src/dynamo-checkpoint-store.ts` | Checkpoint store backed by DynamoDB (with TTL) |
| `src/index.ts` | Lambda entry point that wires up the real dependencies |
| `test/render-photobook.test.ts` | Tests with the Node.js test runner and a fake clock |
| `scripts/invoke-sync.ts` | Synchronous invocation with the AWS SDK v3 (long timeout, no retries, keep-alive) |
| `scripts/invoke_sync.py` | The same with boto3 |

## Run

```bash
npm install
npm run typecheck
npm test
```

Deploy with the Serverless Framework:

```bash
serverless deploy
```

Or synthesize the CDK variant (requires `npm install` first, because `NodejsFunction` needs the lock file):

```bash
npm run cdk:synth
```

Note: the Serverless Framework schema still validates `timeout` against 900 seconds, so `configValidationMode: warn` is set. With aws-cdk-lib 2.277.0, the local CloudFormation check reports rule E3717; the stack acknowledges it with `Validations.of(...).acknowledge()`.

## Tested with

- Node.js 22.23
- TypeScript 5.9.3
- aws-cdk-lib 2.277.0 (`cdk synth` without AWS credentials)
- AWS SDK for JavaScript v3.1173.0

Deploying creates billable AWS resources. Remove them afterwards with `serverless remove` or `cdk destroy`.
