# Debug AccessDenied errors with IAM Access Troubleshooter

Example code for the article
[Debug AccessDenied errors with IAM Access Troubleshooter](https://sascha-ms.de/en/debug-accessdenied-errors-iam-access-troubleshooter)
(German version: [AccessDenied debuggen mit dem IAM Access Troubleshooter](https://sascha-ms.de/2026/3679-accessdenied-debuggen-iam-access-troubleshooter)).

A fictional bike rental API: a Lambda function sends a message to an SQS queue.
The `sqs:SendMessage` permission is missing on purpose, so you can provoke an
AccessDenied error, log its authorization ID and inspect it with IAM Access Troubleshooter.

## Files

| File | Purpose |
| --- | --- |
| `serverless.yml` | Serverless Framework v4 service: HTTP API, Lambda function, SQS queue |
| `src/handler.ts` | Lambda handler that sends a return message to SQS |
| `src/authorization-id.ts` | Extracts the authorization ID from an AccessDenied message |
| `src/log-denied.ts` | Logs AccessDenied errors as one structured JSON line |
| `src/explain-denied.ts` | CLI script: fetches and prints the denied checks and policies |
| `test/authorization-id.test.ts` | Tests for the helper functions (Node.js test runner) |
| `policy.json` | IAM policy with the two read permissions for troubleshooting |

## Run it

```bash
npm install
npm run typecheck
npm test

# deploy (needs AWS credentials and Serverless Framework v4)
npx serverless deploy --stage dev

# inspect an AccessDenied error (needs iam:GetRequestAuthorizationDetails)
npx tsx src/explain-denied.ts --region eu-central-1 "<error message or authorization ID>"
```

To fix the error, uncomment the `sqs:SendMessage` statement in `serverless.yml` and deploy again.

## Tested with

Node.js 22, TypeScript 5.9, @aws-sdk/client-iam-toolbox 3.1172.0, tsx 4.23 (typecheck and tests).
The AWS calls themselves need an AWS account and were not run in CI.
