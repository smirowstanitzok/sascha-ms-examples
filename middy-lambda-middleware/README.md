# Middy middleware for AWS Lambda in TypeScript

Example code for the article:

- English: [Middy middleware for AWS Lambda in TypeScript](https://sascha-ms.de/en/middy-middleware-lambda-typescript)
- German: [Middy Middleware für AWS Lambda in TypeScript](https://sascha-ms.de/2026/3220-middy-middleware-lambda)

A small library API (`POST /loans`) whose handler contains only business logic. Middy wraps it with header normalization, a custom correlation ID middleware, HTTP error handling, JSON body parsing and a custom validation middleware.

## Files

| File | Purpose |
| --- | --- |
| `src/middlewares/correlation-id.ts` | Custom middleware: reuses or creates `x-correlation-id`, also on error responses |
| `src/middlewares/validate-body.ts` | Custom middleware: validates the parsed body, throws HTTP 400 |
| `src/handlers/create-loan.ts` | Handler with the middleware chain (order matters) |
| `test/create-loan.test.ts` | Vitest tests for 201, 400, 409 and 415 |
| `test/order.test.ts` | Shows the onion order and the early response behavior |
| `serverless.yml` | Serverless Framework v4 deployment (Node.js 24, HTTP API) |

## Run

```bash
npm install
npm run typecheck
npm test
```

Deploy (needs an AWS account and Serverless Framework v4):

```bash
serverless deploy
```

## Tested versions

Node.js 22, TypeScript 5.9, Vitest 5.1, Middy 7.9.2 (7 tests green). The `serverless.yml` was validated as YAML, not deployed.
