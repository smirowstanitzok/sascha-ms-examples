# Bulkhead pattern with AWS Lambda

Example code for the article:

- English: [Bulkhead pattern with Lambda: isolate third-party systems](https://sascha-ms.de/en/bulkhead-pattern-lambda)
- German: [Bulkhead Pattern mit Lambda: Drittsysteme isolieren](https://sascha-ms.de/2026/3325-bulkhead-pattern-lambda)

A fictional bike rental: the booking API puts one task per partner (payment, lock, SMS) into that partner's own SQS queue. Every queue has its own worker function with reserved concurrency and a maximum concurrency on the SQS trigger. A hanging partner fills only its own bulkhead, the other partners keep running.

## Files

| File | Purpose |
| --- | --- |
| `src/bulkhead-plan.ts` | Checks a bulkhead plan: max concurrency vs. reserved concurrency, partner limits, account limit |
| `src/partner-worker.ts` | Generic SQS worker with a timeout per partner call and partial batch responses |
| `src/simulation.ts` | Deterministic simulation: shared pool vs. one pool per partner |
| `src/handlers/create-booking.ts` | HTTP API, answers 202 and sends one message per partner queue |
| `src/handlers/*-worker.ts` | One worker per partner (payment, lock, SMS) |
| `scripts/check-plan.ts` | Runs the plan check, e.g. in CI |
| `scripts/simulate.ts` | Prints waiting times with and without bulkheads |
| `test/*.test.ts` | Vitest tests (13) |
| `serverless.yml` | Serverless Framework v4: queues, DLQs, reserved and maximum concurrency, backlog alarm |

## Run

```bash
npm install
npm run typecheck
npm test
npm run check-plan -- 1000
npm run simulate
```

Deploy (needs an AWS account and Serverless Framework v4, creates real resources):

```bash
serverless deploy
```

Remove everything afterwards with `serverless remove`.

## Tested versions

Node.js 22, TypeScript 5.9, Vitest 5.1, @aws-sdk/client-sqs 3.x (13 tests green). The `serverless.yml` was validated as YAML, not deployed. The CDK variant from the article was checked with aws-cdk-lib 2.277 (`cdk synth`).
