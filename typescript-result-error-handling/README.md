# TypeScript error handling: Result types, not throw

Example code for the article:

- English: [TypeScript error handling: Result types, not throw](https://sascha-ms.de/en/typescript-error-handling-result-type)
- German: [TypeScript Fehlerbehandlung: Result-Typ statt throw](https://sascha-ms.de/2026/4128-typescript-fehlerbehandlung-result-typ)

A small bike rental API on AWS Lambda. Expected (domain) errors are returned as a `Result`, technical failures are thrown so Lambda can retry.

## Files

| File | Purpose |
| --- | --- |
| `src/result.ts` | `Result` type, `ok`/`err` helpers and `assertNever` |
| `src/errors.ts` | Error kinds as a discriminated union |
| `src/reservation.ts` | Business logic returning `Result` values |
| `src/http.ts` | Maps every error kind to an HTTP status code (exhaustive `switch`) |
| `src/handler.ts` | Lambda handler for an HTTP API (payload v2) |
| `src/repository.ts` | In-memory repository so the example runs without AWS |
| `test/reservation.test.ts` | Tests with the built-in Node.js test runner |
| `serverless.yml` | Deployment with Serverless Framework v4 |

## Run

```bash
npm install
npm run typecheck
npm test
```

Deploy (optional, needs an AWS account and Serverless Framework v4):

```bash
serverless deploy
serverless remove
```

## Tested with

- Node.js 22.23 (Node.js 24 recommended)
- TypeScript 7.0.2
- @types/node 24.19.4, @types/aws-lambda 8.10.164
