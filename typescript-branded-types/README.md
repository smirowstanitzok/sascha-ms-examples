# TypeScript branded types: type-safe IDs in Lambda

Code for the article **[TypeScript Branded Types: Type-Safe IDs in Lambda](https://sascha-ms.de/en/typescript-branded-types-lambda)** ([German version](https://sascha-ms.de/2026/3066-typescript-branded-types)).

A small loan API for a fictional library: `POST /loans` validates the request with Zod, turns plain strings into branded `MemberId` and `BookId` types via smart constructors and stores the loan in DynamoDB. Swapped IDs no longer compile, and invalid input is rejected with status 400.

## Files

| File | Purpose |
| --- | --- |
| `src/brand.ts` | Generic `Brand<T, B>` type based on a `unique symbol` |
| `src/ids.ts` | `MemberId`, `BookId`, `LoanId` with smart constructors |
| `src/money.ts` | `Cents` brand for amounts in whole cents |
| `src/keys.ts` | Branded DynamoDB partition and sort keys |
| `src/schemas.ts` | Zod schema that returns branded types |
| `src/loan-service.ts` | Domain logic, only works with branded types |
| `src/dynamo-repository.ts` | DynamoDB repository with a conditional `PutItem` |
| `src/handler.ts` | Lambda handler for the HTTP API |
| `test/types.check.ts` | Type tests with `@ts-expect-error` (checked by `tsc`) |
| `test/*.test.ts` | Vitest tests for smart constructors and handler |
| `serverless.yml` | Serverless Framework v4: function, HTTP API, DynamoDB table |

## Run

```bash
npm install
npm run typecheck   # includes the type tests in test/types.check.ts
npm test
```

Deploy (needs AWS credentials and the Serverless Framework v4):

```bash
serverless deploy --stage dev
serverless remove --stage dev
```

## Tested with

TypeScript 7.0.2, Zod 4.6.7, Vitest 5.1.0, Node.js 22 (Lambda runtime `nodejs24.x`). `serverless.yml` was validated as YAML, not deployed.
