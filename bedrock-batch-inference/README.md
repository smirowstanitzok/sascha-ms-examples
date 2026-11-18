# Bedrock batch inference with Lambda and EventBridge

Example code for the article **“Bedrock batch inference: AI jobs overnight at half price”**

- English: https://sascha-ms.de/en/bedrock-batch-inference-lambda
- German: https://sascha-ms.de/2026/3598-bedrock-batch-inference-lambda

A fictional bookshop classifies the previous day's reviews every night with Amazon Bedrock batch inference. One Lambda function builds a JSONL file and starts the job, an EventBridge rule on `Batch Inference Job State Change` invokes a second function that collects the results.

## Files

| File | Purpose |
| --- | --- |
| `src/batch-records.ts` | Pure helpers: build JSONL records (Converse format), parse output lines |
| `src/submit-batch.ts` | Nightly Lambda: reads reviews from S3 and calls `CreateModelInvocationJob` |
| `src/collect-results.ts` | EventBridge-triggered Lambda: reads `*.jsonl.out` and writes `results/<job>.json` |
| `test/batch-records.test.ts` | Unit tests with the Node.js test runner |
| `serverless.yml` | Serverless Framework v4: functions, bucket, Bedrock service role |

## Run

```bash
npm install
npm test
serverless deploy --param="modelId=<your-model-id>"
serverless invoke -f submitBatch
```

Check the quota “Minimum number of records per batch inference job” for your model in Service Quotas and adjust `MIN_RECORDS`.

## Tested with

Node.js 22.23, TypeScript 5.9.3, @aws-sdk/client-bedrock 3.1171.0, @aws-sdk/client-s3 3.1171.0. Unit tests pass locally; deployment was not tested against a live AWS account.
