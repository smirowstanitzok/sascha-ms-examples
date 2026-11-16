# Server-sent events with Lambda for AI chats

A tour advisor for a fictional bike rental on Lake Constance: an AWS Lambda function with response streaming calls Amazon Bedrock `ConverseStream`, runs a tool (`check_availability`) and sends text, tool status, token usage, errors and a closing `done` event to the browser as server-sent events (`text/event-stream`). Infrastructure with AWS CDK.

- Article (English): https://sascha-ms.de/en/server-sent-events-lambda-ai-chat
- Article (German): https://sascha-ms.de/2026/3379-server-sent-events-lambda

## Files

| File | Purpose |
| --- | --- |
| `src/sse.ts` | Event types and SSE formatting |
| `src/tools.ts` | Tool definition (JSON schema) and implementation with fictional stock |
| `src/chat-loop.ts` | Chat loop: reads `ConverseStream` events, assembles tool calls, runs tools, sums tokens |
| `src/handler.ts` | Lambda handler with `awslambda.streamifyResponse` and `HttpResponseStream.from` |
| `web/sse-client.ts` | Browser client: SSE parser for `fetch()` streams and `askAdvisor()` |
| `web/main.ts` | Usage example in a page |
| `lib/advisor-stream-stack.ts`, `bin/app.ts` | CDK stack: Node.js 24 on arm64, function URL with `AWS_IAM` and `RESPONSE_STREAM` |
| `test/*.test.ts` | Vitest tests without an AWS account (fake Bedrock stream, local HTTP server) |

## Run

```bash
npm install
npx tsc --noEmit
npx vitest run
npx cdk synth
npx cdk deploy   # needs AWS credentials, cdk bootstrap and Bedrock model access
```

Test the deployed function URL with curl (7.75 or newer):

```bash
curl --no-buffer "$URL" \
  --aws-sigv4 "aws:amz:eu-central-1:lambda" \
  --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \
  -H "x-amz-security-token: $AWS_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"Is there an e-bike available in Lindau?"}'
```

Check the model ID of the EU inference profile in the Bedrock console before deploying.

## Tested with

Node.js 22, TypeScript 7.0, aws-cdk-lib 2.277, aws-cdk 2.1148, @aws-sdk/client-bedrock-runtime 3.1169, Vitest 5.1 (November 2026).
