# Bedrock Guardrails with Lambda: filter PII and prompt attacks

Example code for the article **“Bedrock Guardrails with Lambda: filter PII and prompt attacks”**

- English: https://sascha-ms.de/en/bedrock-guardrails-lambda
- German: https://sascha-ms.de/2026/3848-bedrock-guardrails-lambda

A small support chat for a fictional bike rental shop (“Speichenwerk”). A Lambda function URL checks every message with the Amazon Bedrock `ApplyGuardrail` API, sends only the checked (possibly masked) text to Claude Haiku 4.5 via the Converse API and checks the answer again before returning it. The guardrail itself (Standard tier, EU guardrail profile, content filters, prompt attack filter, a denied topic, PII masking and a custom regex) is defined in `serverless.yml`.

## Files

| File | Purpose |
| --- | --- |
| `serverless.yml` | Lambda function with function URL, IAM permissions, `AWS::Bedrock::Guardrail` and `AWS::Bedrock::GuardrailVersion` |
| `src/guard.ts` | Calls `ApplyGuardrail` and turns the result into allow / mask / block, without logging matched values |
| `src/handler.ts` | Lambda handler: check input, call the model, check output |
| `src/tool-result.ts` | Runs tool results through the same check before they reach the model (indirect prompt injection) |
| `test/guard.test.ts` | Tests with the built-in Node.js test runner, no AWS account needed |

## Run the tests

```bash
npm install
npx tsc
npm test
```

Expected: `# pass 6` and `# fail 0`.

## Deploy

Requires Serverless Framework v4, an AWS account with Amazon Bedrock access in `eu-central-1` and model access to Claude Haiku 4.5.

```bash
serverless deploy --stage dev
curl -s -X POST "https://<your-function-url>" -H 'content-type: application/json' \
  -d '{"message":"How much is an e-bike for one day?"}'
```

Remove everything again with `serverless remove --stage dev`.

## Tested with

Node.js 22.23, TypeScript 5.9, `@aws-sdk/client-bedrock-runtime` 3.1175. Type check and tests run locally; the deployment needs your own AWS account.
