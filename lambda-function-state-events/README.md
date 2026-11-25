# Lambda function state events: deploy watcher

Example code for the article [Lambda function state events: deployments without polling](https://sascha-ms.de/en/lambda-function-state-events) ([German version](https://sascha-ms.de/2026/4006-lambda-function-state-events)).

A small deploy watcher for the fictional bike rental "Radwerk": two EventBridge rules on the default bus react to failed activations/updates and to newly published versions of all functions starting with `radwerk-`. A Lambda function filters out duplicates with DynamoDB (conditional write + TTL), looks up the current status with `GetFunctionConfiguration` and notifies the team via SNS. Undeliverable events go to an SQS dead-letter queue.

## Files

| File | Purpose |
| --- | --- |
| `serverless.yml` | Serverless Framework v4 service: function, two EventBridge rules, SNS topic, DynamoDB table, DLQ |
| `src/state-event.ts` | Pure functions: parse ARN, classify event, dedupe key, build message |
| `src/dedupe.ts` | Duplicate detection with a conditional DynamoDB write |
| `src/handler.ts` | Lambda handler |
| `test/state-event.test.ts` | Unit tests with the Node.js test runner |
| `events/update-failed.json` | Sample "Event Function Version Update Failed" event |
| `events/pattern-failed.json` | Event pattern for `aws events test-event-pattern` |

## Run

```bash
npm install
npx tsc --noEmit
npm test

# check the pattern without deploying (needs AWS credentials)
aws events test-event-pattern --event-pattern file://events/pattern-failed.json --event file://events/update-failed.json

# deploy and try the handler with the sample event
serverless deploy --stage dev
serverless invoke --stage dev --function deployWatch --path events/update-failed.json
```

## Tested with

- Node.js 22.23 (type stripping, tests) and runtime `nodejs24.x` on Lambda
- TypeScript 5.9.3
- AWS SDK for JavaScript v3 3.1177.0
- Serverless Framework v4 (not deployed in the test run; `tsc` and tests passed: 7/7)

All names and data are fictional.
