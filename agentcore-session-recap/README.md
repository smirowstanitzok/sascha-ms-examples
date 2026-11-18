# AgentCore Memory session summaries: support agent with memory

Example code for the article:

- English: [AgentCore Memory Session Summaries for AI Agents](https://sascha-ms.de/en/agentcore-memory-session-summaries)
- German: [AgentCore Memory: Sitzungszusammenfassungen für KI-Agenten](https://sascha-ms.de/2026/3650-agentcore-memory-sitzungszusammenfassung)

A small support assistant for the fictional bike rental "Radwerk". It stores every chat turn as an event in Amazon Bedrock AgentCore Memory, reads the full session summaries (record type `FULL_SESSION`) of earlier sessions and passes them into the system prompt of a Bedrock Converse call. Infrastructure: Serverless Framework v4, TypeScript.

## Files

| File | Purpose |
| --- | --- |
| `serverless.yml` | HTTP API, three Lambda functions, `AWS::BedrockAgentCore::Memory` with a summary strategy |
| `src/memory.ts` | All AgentCore Memory calls: write events, read turns, read recaps (filter on `FULL_SESSION`) |
| `src/prompt.ts` | Builds the system prompt from recaps and the Converse message list |
| `src/http.ts` | Customer ID from JWT claim `sub` (header fallback only in the dev stage), JSON helpers |
| `src/chat.ts` | `POST /chat` |
| `src/recap.ts` | `GET /sessions/{sessionId}/recap` and `GET /history` |
| `test/memory.test.ts` | Unit tests with a fake client, no AWS account needed |

## Run

```bash
npm install
npx tsc --noEmit
npm test
```

Deploy (needs AWS credentials, Bedrock model access and a region with AgentCore Memory):

```bash
npx serverless deploy --stage dev
```

In the dev stage the customer ID comes from the `x-demo-customer` header. In every other stage it must come from a JWT authorizer (claim `sub`).

## Notes

- Summaries are created asynchronously. A `404` from the recap endpoint right after the first message is expected.
- `EventExpiryDuration` is 30 days in dev and 365 days by default. The API allows up to 3650 days; check whether CloudFormation accepts values above 365 in your region.
- Consider `RecordExpiryDurationDays` on the strategy so long-term records do not grow forever.

Checked with Node.js 22, TypeScript 5.9, `@aws-sdk/client-bedrock-agentcore` 3.1171.0 (type check and unit tests; not deployed against AWS).
