# Step Functions Distributed Map: Process CSV with Lambda

Example code for the article [Step Functions Distributed Map: Process CSV with Lambda](https://sascha-ms.de/en/step-functions-distributed-map-csv-lambda/) (German version: [Step Functions Distributed Map: CSV mit Lambda verarbeiten](https://sascha-ms.de/2026/3020-step-functions-distributed-map/)).

A fictional city library imports a nightly catalog export (semicolon-separated CSV) from S3. A Step Functions Distributed Map reads the file, groups 500 rows per batch, runs at most 20 Express child workflows in parallel and writes a result report back to S3. A Lambda function validates each row (ISBN-13 check digit, title, year, copies) and stores valid books in DynamoDB.

## Files

| File | Purpose |
| --- | --- |
| `serverless.yml` | Lambda function, Distributed Map state machine, S3 bucket, DynamoDB table and IAM role (Serverless Framework v4 + `serverless-step-functions`) |
| `src/validate-row.ts` | Pure validation of a single CSV row |
| `src/import-batch.ts` | Lambda handler for one batch, writes to DynamoDB with retries for unprocessed items |
| `test/*.test.ts` | Vitest tests for validation and the handler (DynamoDB mocked) |
| `scripts/generate-csv.ts` | Generates a test CSV, every 1000th row is broken on purpose |

## Run it

```bash
npm install
npx tsc --noEmit
npx vitest run

npx tsx scripts/generate-csv.ts 200000
serverless deploy

BUCKET=$(serverless info --verbose | grep ImportBucketName | awk '{print $2}')
SM_ARN=$(serverless info --verbose | grep StateMachineArn | awk '{print $2}')
aws s3 cp katalog.csv "s3://$BUCKET/eingang/katalog.csv"
aws stepfunctions start-execution --state-machine-arn "$SM_ARN" --input '{"key": "eingang/katalog.csv"}'
```

Results land in `s3://$BUCKET/ergebnisse/<map-run-id>/` (`manifest.json`, `SUCCEEDED_0.json`, `FAILED_0.json`).

Remove everything afterwards with `serverless remove` (empty the bucket first).

## Tested with

Node.js 22, TypeScript 7.0.2, Vitest 5.1.0, AWS SDK for JavaScript v3.1169.0, serverless-step-functions 3.31.2, Serverless Framework v4. The state machine definition was validated with asl-validator 4.0.0; the deployment itself was not run as part of this example.
