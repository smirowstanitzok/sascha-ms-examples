# Lambda Power Tuning: Find the Right Memory Size

Example code for the article **Lambda Power Tuning: Find the Right Memory Size**

- English: https://sascha-ms.de/en/lambda-power-tuning
- German: https://sascha-ms.de/2026/4179-lambda-power-tuning

A fictional bakery export (CSV + gzip + SHA-256) is deployed twice with the Serverless Framework (x86 and arm64). AWS Lambda Power Tuning is installed from the Serverless Application Repository with AWS CDK, restricted to functions with the prefix `bakery-export-`. A small TypeScript script starts the state machine, waits for the result and prints a table plus a "sweet spot" recommendation.

## Files

| File | Purpose |
| --- | --- |
| `infra/tuner-stack.ts` | CDK stack that installs Lambda Power Tuning (SAR app 4.4.0) with least-privilege `lambdaResource` |
| `infra/app.ts`, `cdk.json` | CDK app entry point (Node.js type stripping, no ts-node) |
| `serverless.yml` | Test function deployed for `x86_64` and `arm64` |
| `src/handler.ts` | CPU-heavy sample handler |
| `src/report.ts` | Turns the state machine output into a table and picks a sweet spot |
| `scripts/run-tuning.ts` | Starts an execution, polls it and prints the report |
| `tuning-input.json` | Execution input (replace the account ID) |
| `tests/report.test.ts` | Unit tests with `node:test` |

## Run

```bash
npm install
npm run typecheck
npm test
npx cdk deploy PowerTuner          # installs the tuning state machine
serverless deploy                  # deploys bakery-export-x86-dev and bakery-export-arm-dev
export TUNER_ARN="<StateMachineArn output of the CDK stack>"
npm run tune -- tuning-input.json
```

The measurement really invokes your function (210 invocations with the sample input). Run it in a test account.

## Tested with

Node.js 22.23, TypeScript 5.9.3, aws-cdk-lib 2.278.0, aws-cdk CLI 2.1149.0, @aws-sdk/client-sfn 3.1178.0, AWS Lambda Power Tuning 4.4.0 (SAR). `tsc --noEmit`, `node --test` (6 tests) and `cdk synth` pass. Serverless Framework v4 is required for `serverless deploy`.
