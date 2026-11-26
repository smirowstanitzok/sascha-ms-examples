# EventBridge webhook events: webhooks without your own API

Example code for the article:

- English: [EventBridge webhook events: webhooks without your own API](https://sascha-ms.de/en/eventbridge-webhook-events)
- German: [EventBridge Webhook Events: Webhooks ohne eigene API](https://sascha-ms.de/2026/4139-eventbridge-webhook-events)

A fictional bike rental ("Radwerk") receives payment webhooks from a fictional payment provider ("Kassenfuchs").
EventBridge hosts the webhook URL, verifies the Standard Webhooks HMAC signature, drops duplicates and publishes
accepted requests to a new-generation custom event bus (`AWS::EventsV2`). A subscriber invokes a Lambda function
that books the payment idempotently in DynamoDB.

## Files

| File | Purpose |
| --- | --- |
| `bin/app.ts` | CDK app entry point |
| `lib/payment-webhook-stack.ts` | Bus, webhook source, roles, DynamoDB table, Lambda function, subscriber, DLQ |
| `src/payment-events.ts` | Lambda consumer: validation, idempotency marker, ordering by `createdAt` |
| `src/standard-webhooks.ts` | Signs requests like a Standard Webhooks provider (used by the test script) |
| `src/payment-events.test.ts` | Tests with the built-in Node.js test runner |
| `scripts/send-test-webhook.ts` | Sends a signed test webhook twice to the webhook URL |
| `snippets/serverless-webhook.yml` | The same webhook source as a Serverless Framework resource |

## Run

```bash
npm install
npm test            # 5 tests, no AWS account needed
npm run typecheck
npx cdk synth       # shows warning CloudFormation-Validate::F3018 (outdated bundled schema, safe to ignore)
npx cdk deploy
```

Get URL and secret after the deployment:

```bash
SOURCE_ARN=$(aws cloudformation describe-stacks --stack-name RadwerkPaymentWebhook \
  --query "Stacks[0].Outputs[?OutputKey=='WebhookSourceArn'].OutputValue" --output text)
export WEBHOOK_URL=$(aws eventsv2 describe-event-source --event-source-arn "$SOURCE_ARN" \
  --query 'EventSourceDetails.WebhookDetails.WebhookUrl' --output text)
SECRET_ARN=$(aws eventsv2 describe-event-source --event-source-arn "$SOURCE_ARN" \
  --query 'EventSourceDetails.WebhookDetails.SecretArn' --output text)
export WEBHOOK_SECRET=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" \
  --query SecretString --output text)
npm run send        # or: npm run send -- refund
```

Clean up with `npx cdk destroy`.

## Tested versions

- Node.js 22
- aws-cdk-lib 2.278.0, aws-cdk 2.1149.0
- AWS SDK for JavaScript v3 3.1178.0
- TypeScript 5.9
