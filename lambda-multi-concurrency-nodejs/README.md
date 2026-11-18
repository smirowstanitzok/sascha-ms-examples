# Lambda multi-concurrency: safe Node.js handlers on LMI

Example code for the article **Lambda multi-concurrency: safe Node.js handlers on LMI**

- English: https://sascha-ms.de/en/lambda-multi-concurrency-nodejs
- German: https://sascha-ms.de/2026/3614-lambda-multi-concurrency-nodejs

On Lambda Managed Instances, one execution environment handles many invocations at the same time. This example shows a ticket shop handler that mixes up data under concurrency, a safe version, a script that finds shared state, and tests that reproduce the bug locally.

## Files

| File | Purpose |
| --- | --- |
| `src/shop.ts` | Business logic of the fictional ticket shop (types, simulated price list) |
| `src/handler-unsafe.ts` | Broken on purpose: request data in module scope, lazy init without memoized promise, fixed `/tmp` file |
| `src/handler.ts` | Safe handler using AsyncLocalStorage, `once()` and unique `/tmp` file names |
| `src/request-context.ts` | Request context via `AsyncLocalStorage` |
| `src/once.ts` | Lazy initialization that runs exactly once under concurrency |
| `scripts/find-shared-state.ts` | Finds mutable module state, `/tmp` paths, `process.on` and `_X_AMZN_TRACE_ID` with the TypeScript compiler API |
| `scripts/invoke-parallel.ts` | Invokes the deployed function 100 times concurrently and checks every response |
| `test/*.test.ts` | Concurrency tests and tests for the check script (Node.js test runner) |
| `serverless.yml` | Serverless Framework v4 project with capacity provider for Lambda Managed Instances |

## Run locally

```bash
npm install
npm test                    # 8 tests, no AWS account needed
npm run typecheck
npm run find-shared-state   # lists spots to check in src/
```

## Deploy (optional, costs money)

Enter two subnets and a security group in `serverless.yml`, then:

```bash
npx serverless deploy
npx tsx scripts/invoke-parallel.ts ticket-shop-receipts-dev-createReceipt
npx serverless remove
```

The deployment was not tested live; the local tests were.

## Tested with

Node.js 22.23, TypeScript 5.9.3, tsx 4.23, @aws-sdk/client-lambda 3.1171.0
