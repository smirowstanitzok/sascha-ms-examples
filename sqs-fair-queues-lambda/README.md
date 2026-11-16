# SQS fair queues: tame noisy neighbors in Lambda

Example code for the article [SQS fair queues: tame noisy neighbors in Lambda](https://sascha-ms.de/en/sqs-fair-queues-lambda) (German version: [SQS Fair Queues: Noisy Neighbor bei Lambda zähmen](https://sascha-ms.de/2026/3392-sqs-fair-queues-lambda)).

A fictional "club planner" SaaS sends jobs for many sports clubs (tenants) to one SQS standard queue. Setting the club ID as `MessageGroupId` activates SQS fair queues, so one club's large import no longer delays everyone else.

## Files

| File | Purpose |
| --- | --- |
| `src/job.ts` | Job type and validation |
| `src/enqueue.ts` | Producer: batches jobs and sets the club ID as `MessageGroupId` |
| `src/worker.ts` | Lambda worker with partial batch responses and structured logs |
| `lib/club-jobs-stack.ts` | CDK stack: queue, DLQ, worker, alarms on the fair-queue metrics, Contributor Insights rule |
| `bin/app.ts` | CDK app entry point |
| `scripts/load.ts` | Load test against a deployed queue (one noisy club, four quiet ones) |
| `scripts/simulate.ts` | Heavily simplified local simulation (not the real SQS algorithm) |
| `test/fair-queues.test.ts` | Vitest tests |

## Run

```bash
npm install
npm run build      # type check
npm test           # unit tests and simulation check
npm run simulate   # local simulation, no AWS account needed
npx cdk synth
npx cdk deploy     # needs AWS credentials and cdk bootstrap
QUEUE_URL=<QueueUrl output> npx tsx scripts/load.ts
```

Deploying creates billable resources (SQS, Lambda, CloudWatch alarms, a Contributor Insights rule). Run `npx cdk destroy` when you are done.

## Tested with

Node.js 22, TypeScript 7.0.2, aws-cdk-lib 2.277.0, aws-cdk 2.1148.1, Vitest 5.1.0, @aws-sdk/client-sqs 3.1169.0.
