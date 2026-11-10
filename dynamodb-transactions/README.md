# DynamoDB transactions: TransactWriteItems with Lambda

Example code for the article:

- English: [DynamoDB transactions: TransactWriteItems with Lambda](https://sascha-ms.de/en/dynamodb-transactions-transactwriteitems-lambda)
- German: [DynamoDB Transaktionen: TransactWriteItems mit Lambda](https://sascha-ms.de/2026/2541-dynamodb-transaktionen)

A small bike rental API: starting a rental checks the station, updates the customer and the bike and creates the rental in one atomic `TransactWriteItems` call. `CancellationReasons` are mapped to domain errors, conflicts are retried with full jitter, and repeated requests with the same `Idempotency-Key` are answered as replays.

## Files

| File | Purpose |
| --- | --- |
| `src/rental-service.ts` | Builds and runs the transactions, maps cancellation reasons, conflict retry |
| `src/handler.ts` | Lambda handlers for `POST /rentals` and `POST /rentals/{rentalId}/return` |
| `test/rental-service.test.ts` | Vitest tests without a real table |
| `serverless.yml` | Serverless Framework v4: HTTP API, table, IAM with `dynamodb:EnclosingOperation` |

## Run

```bash
npm install
npm run typecheck
npm test
npx serverless deploy
```

Deploying requires AWS credentials and a Serverless Framework v4 login or license key. Remove everything with `npx serverless remove`.

Tested with Node.js 22, TypeScript 5.9, Vitest 5.1 and AWS SDK for JavaScript v3.1165.
