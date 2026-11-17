# Secure Bedrock API keys: SCP, CloudTrail and alerts

A small Serverless Framework v4 service that watches CloudTrail via EventBridge and sends an SNS email when someone creates a long-term Amazon Bedrock API key or calls Bedrock with an API key (bearer token). One alert per principal and time window (deduplication in DynamoDB), allow list for principals that use keys on purpose. Also included: a sample service control policy and a script that lists all Bedrock API keys in an account.

- Article (English): [Secure Bedrock API keys: SCP, CloudTrail and alerts](https://sascha-ms.de/en/secure-bedrock-api-keys)
- Article (German): [Bedrock API Keys absichern: SCP, CloudTrail und Alarm](https://sascha-ms.de/2026/3479-bedrock-api-keys-absichern)

## Files

| File | Purpose |
| --- | --- |
| `src/classify.ts` | Pure logic: decides whether a CloudTrail event is worth an alert |
| `src/handler.ts` | Lambda handler: deduplication in DynamoDB, publish to SNS |
| `serverless.yml` | Function, EventBridge rules, SNS topic, DynamoDB table with TTL |
| `test/classify.test.ts` | Vitest tests for classification, allow list and deduplication |
| `events/*.json` | Sample CloudTrail events (bearer token call, key creation) |
| `policies/scp-bedrock-api-keys.json` | Sample SCP with rules for Bedrock API keys |
| `scripts/find-bedrock-keys.sh` | Lists all long-term Bedrock API keys in the current account |

## Run it

```bash
npm install
npm run typecheck
npm test
```

Deploy (IAM events arrive in `us-east-1`, Bedrock events in the region you use):

```bash
serverless deploy --region us-east-1 --param="alertEmail=security@example.com"
serverless deploy --region eu-central-1 --param="alertEmail=security@example.com"
serverless invoke --function notify --path events/bearer-token.json --region eu-central-1
```

Deploying creates real resources (Lambda, EventBridge rules, SNS, DynamoDB). Test the SCP in a sandbox OU first. Remove the stacks with `serverless remove`.

## Tested with

Node.js 22, TypeScript 5.9, Vitest 3 (type check and 8 tests passed). `serverless package` needs a Serverless Framework v4 login and was not part of the check.
