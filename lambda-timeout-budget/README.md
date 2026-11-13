# Lambda timeouts as one time budget

One time budget from API Gateway down to every SDK call: a `Deadline` class built on `context.getRemainingTimeInMillis()` and `AbortSignal`, an AWS SDK client with real request timeouts, a partner API call that never outlives the budget, and an SQS worker that stops before Lambda kills it. Fictional example domain: a bike rental.

- Article (English): https://sascha-ms.de/en/lambda-timeout-budget
- Article (German): https://sascha-ms.de/2026/2878-lambda-timeout-zeitbudget

## Files

| File | Purpose |
| --- | --- |
| `src/deadline.ts` | Time budget with reserve, upper limit and one `AbortSignal` per step |
| `src/partner-client.ts` | Partner API call with retries that stay inside the budget |
| `src/handler.ts` | HTTP API handler: DynamoDB with SDK timeouts, partial answer when the partner hangs |
| `src/worker.ts` | SQS worker that hands messages back via `batchItemFailures` when time runs out |
| `test/deadline.test.ts` | Vitest tests with a fake clock and a `fetch` that never answers |
| `serverless.yml` | Serverless Framework v4: HTTP API, SQS queue with DLQ (visibility timeout 6 × function timeout), DynamoDB table |

## Run it

```bash
npm install
npm run typecheck
npm test
```

Deploy (optional, creates resources in your AWS account):

```bash
serverless deploy
```

Important detail: `requestTimeout` in `NodeHttpHandler` only throws when `throwOnRequestTimeout: true` is set; otherwise it only logs a warning.

## Tested with

Node.js 22.23, TypeScript 5.9, Vitest 5.1, AWS SDK for JavaScript 3.1168. The `serverless.yml` was validated as YAML, not deployed.
