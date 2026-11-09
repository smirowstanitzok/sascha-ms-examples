# DynamoDB optimistic locking with Lambda and CDK

Example code for the article **“DynamoDB optimistic locking: version numbers with Lambda”**

- English: https://sascha-ms.de/en/dynamodb-optimistic-locking
- German: https://sascha-ms.de/2026/2473-dynamodb-optimistic-locking

A small, made-up bike rental API: every bike item carries a `version` attribute, writes only succeed with
`ConditionExpression: '#version = :expected'`, conflicts are resolved by reading and deciding again
(machine decisions) or answered with `412 Precondition Failed` via `ETag`/`If-Match` (human decisions).

## Files

| File | Purpose |
| --- | --- |
| `src/bike.ts` | Data model and pure business logic (rent, return) |
| `src/bike-repository.ts` | Get, create with `attribute_not_exists`, conditional save with version + 1 |
| `src/optimistic-retry.ts` | Retry helper with full jitter that re-runs read → decide → write |
| `src/handlers/bikes.ts` | Lambda handler for the HTTP API (rent, return, PATCH with If-Match) |
| `lib/bike-rental-stack.ts` | AWS CDK stack: DynamoDB table, Node.js 24 Lambda on ARM, HTTP API |
| `bin/app.ts` | CDK app entry point |
| `test/*.test.ts` | Vitest tests with `aws-sdk-client-mock` (conflicts are simulated) |

## Run

```bash
npm install
npx tsc --noEmit
npx vitest run
npx cdk synth
npx cdk deploy   # needs AWS credentials, creates billable resources
npx cdk destroy
```

Tested with Node.js 22/24, TypeScript 7.0, Vitest 5.1, aws-cdk-lib 2.275, AWS SDK for JavaScript v3.1164.

The demo API has no authentication and the table uses `RemovalPolicy.DESTROY` – do not use it as-is in production.
