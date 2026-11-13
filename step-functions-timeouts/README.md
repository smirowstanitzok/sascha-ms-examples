# Step Functions timeout: getting heartbeats right

Example code for the article series “Serverless patterns in practice”, part 15.

- English article: https://sascha-ms.de/en/step-functions-timeout-heartbeats/
- German article: https://sascha-ms.de/2026/2934-step-functions-timeout-heartbeat/

A fictional bike rental returns an e-bike: a Step Functions workflow calculates the fee (Lambda task with a task timeout slightly above the Lambda timeout) and then waits for a battery check via SQS and a task token. The worker Lambda sends heartbeats every 20 seconds, stops on its own time budget and drops messages whose task has already timed out. Timeouts and failures are caught and routed to an SNS topic for the workshop.

## Files

| File | Purpose |
| --- | --- |
| `bin/app.ts` | CDK app entry point |
| `lib/bike-return-stack.ts` | State machine with TimeoutSeconds, HeartbeatSeconds, Retry and Catch, plus queue, worker and SNS topic |
| `src/calculate-fee.ts` | Small Lambda function that calculates the rental fee |
| `src/heartbeat.ts` | `runWithHeartbeat` helper: immediate first heartbeat, interval heartbeats, abort when the task is gone |
| `src/battery-diagnosis.ts` | Simulated three-step battery diagnosis that respects an `AbortSignal` |
| `src/battery-check-worker.ts` | SQS worker that reports results with SendTaskSuccess / SendTaskFailure |
| `test/*.test.ts` | Vitest tests for the helper, the worker and the synthesized state machine |

## Run it

```bash
npm install
npm run build   # type check
npm test        # 12 tests, no AWS account needed
npx cdk synth   # CloudFormation template
npx cdk deploy  # needs AWS credentials and a bootstrapped account
```

Start an execution after deploying:

```bash
aws stepfunctions start-execution \
  --state-machine-arn <ARN> \
  --input '{"rentalId":"R-1001","bikeId":"ebike-7","minutes":42}'
```

Try `"bikeId":"offline-3"` (retries, then the workshop path), set `HEARTBEAT_INTERVAL_MS=90000` on the worker (heartbeat timeout) or `DIAGNOSIS_STEP_MS=100000` (worker budget kicks in). Clean up with `npx cdk destroy`.

## Tested with

Node.js 22, TypeScript 5.9, aws-cdk-lib 2.277.0, AWS CDK CLI 2.1148.1, @aws-sdk/client-sfn 3.1168.0, Vitest 5.1.0 (November 2026).
