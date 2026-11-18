# Pause durable functions: an emergency brake for Lambda workflows

Example code for the article
[How to pause durable functions in AWS Lambda](https://sascha-ms.de/en/pause-durable-functions)
(German version: [Durable Functions pausieren: Notbremse für Lambda](https://sascha-ms.de/2026/3639-durable-functions-pausieren)).

A small TypeScript CLI that pauses, resumes and purges AWS Lambda durable executions of one function,
using `PauseDurableExecution`, `ResumeDurableExecution` and `DeleteDurableExecution`.

## Files

| File | Purpose |
| --- | --- |
| `src/order-workflow.ts` | Fictional bookshop order workflow (durable function with three steps and a wait) |
| `src/brake.ts` | List, pause, resume and purge executions (pagination, limited concurrency, client tokens) |
| `src/cli.ts` | Command-line entry point |
| `test/brake.test.ts` | Tests with a replaced `send()` method, no AWS access needed |

## Run

```bash
npm install
npm test
npm run typecheck
npm run brake -- pause bookshop-orders --reason "Payment provider outage" --dry-run
npm run brake -- pause bookshop-orders --reason "Payment provider outage"
npm run brake -- resume bookshop-orders --reason "Payment provider recovered"
npm run brake -- purge bookshop-orders --before 2026-10-01        # dry run
npm run brake -- purge bookshop-orders --before 2026-10-01 --yes  # deletes
```

The CLI uses your default AWS credentials and region (`AWS_REGION`).
Pausing an execution while an invocation is in progress needs `@aws/durable-execution-sdk-js` 2.5.0 or later in the function.

## Tested with

Node.js 22, TypeScript 5.9, `@aws-sdk/client-lambda` 3.1171.0, `@aws/durable-execution-sdk-js` 3.0.0, tsx 4.23.
Tests and type check pass locally; the CLI was not run against a live AWS account.
