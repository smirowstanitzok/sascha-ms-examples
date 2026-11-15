# Step Functions activity worker (TypeScript + AWS CDK)

Example code for the article **“Step Functions Activity vs. Callback: When to Poll”**

- English: https://sascha-ms.de/en/step-functions-activity-worker
- German: https://sascha-ms.de/2026/3180-step-functions-activity-worker

A fictional bike rental prints rental contracts on a shop PC that accepts no inbound connections. The shop PC runs a Node.js worker that polls a Step Functions activity, sends heartbeats and reports the result.

## Files

| File | Purpose |
| --- | --- |
| `bin/app.ts` | CDK app entry point |
| `lib/contract-print-stack.ts` | Activity, standard state machine, worker role, CloudWatch alarm |
| `src/print-contract.ts` | Simulated print logic with input validation |
| `src/activity-worker.ts` | Worker with several pollers, slot limit, heartbeats, clean shutdown |
| `src/main.ts` | Start script (reads `ACTIVITY_ARN`, `POLLERS`, `MAX_PARALLEL_JOBS`) |
| `test/activity-worker.test.ts` | Vitest tests with `aws-sdk-client-mock` |

## Run

```bash
npm install
npx tsc --noEmit
npx vitest run
npx cdk synth

# deploy (needs AWS credentials)
npx cdk deploy
ACTIVITY_ARN="<ActivityArn>" AWS_REGION=eu-central-1 npm run worker
```

Start an execution:

```bash
aws stepfunctions start-execution \
  --state-machine-arn "<StateMachineArn>" \
  --input '{"rentalId":"r-1001","customerName":"Mia Example","bikeId":"b-17"}'
```

Clean up with `npx cdk destroy`.

## Tested with

Node.js 22, TypeScript 7.0.2, aws-cdk-lib 2.277.0, aws-cdk 2.1148.1, @aws-sdk/client-sfn 3.1169.0, @smithy/node-http-handler 4.14.2, Vitest 5.1.0, aws-sdk-client-mock 4.1.0.
