# DynamoDB Streams AT_TIMESTAMP: replay from a point in time

**Article:** [DynamoDB Streams AT_TIMESTAMP: Replay From a Point in Time](https://sascha-ms.de/en/dynamodb-streams-at-timestamp-replay) (English) · [German original](https://sascha-ms.de/2026/173-dynamodb-streams-at-timestamp-replay)

With the shard iterator type `AT_TIMESTAMP` you can read a DynamoDB stream again from a point in time. This project has one business function and two lean Lambda handlers that use it:

| File | What it does |
| --- | --- |
| `src/process.ts` | The business logic, independent of where the records come from |
| `src/replay.ts` | Reads all shards from a timestamp until the end of the time window |
| `src/replay-handler.ts` | Lambda that runs a replay for a time window |
| `src/live-handler.ts` | Lambda for the normal stream trigger |
| `lib/orders-stack.ts` | CDK stack: table with stream, both Lambdas, least-privilege permissions |
| `test/replay.test.ts` | Tests for the replay logic, without AWS |

## Run it

```bash
npm install
npm test           # three tests, no AWS account needed
npx cdk synth
npx cdk deploy     # creates AWS resources that may cost money
```

Trigger a replay (take the function name from the CDK output):

```bash
aws lambda invoke --function-name <ReplayFunctionName> --cli-binary-format raw-in-base64-out --payload '{"from":"2026-10-22T08:00:00Z","until":"2026-10-22T09:00:00Z"}' replay-result.json
```
