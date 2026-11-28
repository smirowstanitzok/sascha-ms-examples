# DynamoDB pagination: cursor API with Lambda

Example code for the article **DynamoDB pagination: build a cursor API with Lambda**

- English: https://sascha-ms.de/en/dynamodb-pagination-cursor-api-lambda
- German: https://sascha-ms.de/2026/4278-dynamodb-pagination-cursor-lambda

A small REST API for a fictional bike rental lists the rentals of a station page by page. DynamoDB's `LastEvaluatedKey` is handed out as an HMAC-signed, query-bound cursor, and filtered pages are filled across several queries without losing items.

## Files

| File | Purpose |
| --- | --- |
| `src/cursor.ts` | Sign and verify the opaque cursor (HMAC-SHA256, query fingerprint, expiry) |
| `src/list-rentals.ts` | Page logic: fills pages with a filter, trims and builds the next key |
| `src/handler.ts` | Lambda handler for `GET /stations/{stationId}/rentals` (HTTP API) |
| `serverless.yml` | Serverless Framework v4: function, HTTP API, DynamoDB table, IAM |
| `seed.ts` | Writes 60 sample rentals for the station `harbor` |
| `test/fake-dynamodb.ts` | In-memory replica of Query behavior (Limit before filter) |
| `test/*.test.ts` | Vitest tests for cursor and paging |

## Run

```bash
npm install
npx tsc --noEmit
npx vitest run
```

If `npm install` fails with npm 10 and the message `Cannot read properties of null (reading 'edgesOut')`, use `npm install --legacy-peer-deps` or npm 11.

Deploy (requires AWS credentials and a Serverless Framework v4 login):

```bash
aws ssm put-parameter --name /bike-rentals/cursor-secret --type SecureString \
  --value "$(openssl rand -base64 48)" --region eu-central-1
npx serverless deploy
node seed.ts <table name>
curl "https://<api-id>.execute-api.eu-central-1.amazonaws.com/stations/harbor/rentals?limit=5"
```

Clean up:

```bash
npx serverless remove
aws ssm delete-parameter --name /bike-rentals/cursor-secret --region eu-central-1
```

## Tested with

Node.js 22.23, TypeScript 5.9.3, Vitest 4.1.12, @aws-sdk/client-dynamodb and @aws-sdk/lib-dynamodb 3.1179.0, Serverless Framework 4.47 (config only). 9 tests passing.
