# WebSocket API with Lambda: a live ticker step by step

Example code for the article [WebSocket API with Lambda: a live ticker step by step](https://sascha-ms.de/en/websocket-api-lambda-live-ticker) (German version: [WebSocket API mit Lambda: Live-Ticker Schritt für Schritt](https://sascha-ms.de/2026/3911-websocket-api-mit-lambda)).

A fictional sports club runs a live ticker for its matches. Fans connect to an API Gateway WebSocket API with `?match=<match-id>`, the connection is stored in DynamoDB (with a GSI per match and a TTL for lost `$disconnect` events), and a `publish` Lambda sends every new event to all fans of that match through the `@connections` API. Stale connections (HTTP 410) are removed automatically.

## Files

| File | Purpose |
| --- | --- |
| `src/connections.ts` | Connection store in DynamoDB (`PutItem`, `DeleteItem`, paginated `Query` on the `byMatch` index) |
| `src/broadcast.ts` | Sends one payload to many connections with capped concurrency and reports sent/gone/failed |
| `src/sender.ts` | `PostToConnection` with `@aws-sdk/client-apigatewaymanagementapi`, maps `GoneException` to `gone` |
| `src/handlers.ts` | Lambda handlers `connect`, `disconnect`, `ping` (route response) and `publish` (invoked directly via IAM) |
| `lib/live-ticker-stack.ts` | AWS CDK stack: DynamoDB table, four `NodejsFunction`s, `WebSocketApi`, `WebSocketStage` with throttling |
| `bin/app.ts`, `cdk.json` | CDK app entry point (runs with `tsx`) |
| `client/fan.ts` | Fan client using the WebSocket client built into Node.js, sends a ping every 5 minutes |
| `test/*.test.ts` | Tests with the built-in Node.js test runner |

## Run

```bash
npm install
npm run typecheck
npm test                 # node --test with built-in type stripping (Node.js 22.18+)
npx cdk synth --quiet
npx cdk deploy           # needs AWS credentials and a bootstrapped account
```

Connect one or more fans (use `WebSocketUrl` from the deploy output):

```bash
node client/fan.ts wss://abc123.execute-api.eu-central-1.amazonaws.com/live blues-vs-reds
```

Report an event (use `PublishFunctionName` from the deploy output):

```bash
aws lambda invoke \
  --function-name <PublishFunctionName> \
  --cli-binary-format raw-in-base64-out \
  --payload '{"matchId":"blues-vs-reds","minute":23,"text":"Goal for the Blues!","score":"1:0"}' \
  response.json && cat response.json
```

Deploying creates billable resources (API Gateway, Lambda, DynamoDB, CloudWatch Logs). Run `npx cdk destroy` when you are done.

## Tested with

Node.js 22.23, TypeScript 7.0.2, aws-cdk-lib 2.278.0, aws-cdk 2.1149.0, AWS SDK for JavaScript v3.1175.0 (type check, `node --test`, `cdk synth`). Lambda runtime: Node.js 24 on arm64.
