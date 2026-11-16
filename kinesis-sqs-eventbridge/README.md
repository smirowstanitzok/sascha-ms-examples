# Kinesis vs. SQS vs. EventBridge: one project, three services

Example code for the article **Kinesis vs. SQS vs. EventBridge: Which One When?**

- English: https://sascha-ms.de/en/kinesis-sqs-eventbridge-comparison
- German: https://sascha-ms.de/2026/3447-kinesis-sqs-eventbridge-vergleich

A fictional bike rental ("Radwerk") uses all three services:

- **Kinesis Data Streams** for bike telemetry (ordered per bike, partition key = bike ID)
- **EventBridge** for the business event `RentalEnded`
- **SQS** as a buffer between EventBridge and the invoice function (with DLQ)

## Files

| File | Purpose |
| --- | --- |
| `serverless.yml` | Serverless Framework v4 configuration incl. stream, bus, archive, queues and rules |
| `src/lib/telemetry.ts` | Validation and "latest per bike" logic |
| `src/lib/tariff.ts` | Fictional tariff for invoices |
| `src/lib/events.ts` | Event source, detail type and detail shape |
| `src/handlers/send-telemetry.ts` | HTTP -> Kinesis `PutRecord` |
| `src/handlers/process-telemetry.ts` | Kinesis consumer with partial batch response |
| `src/handlers/end-rental.ts` | HTTP -> EventBridge `PutEvents` (checks `FailedEntryCount`) |
| `src/handlers/create-invoice.ts` | SQS consumer with partial batch response |
| `src/handlers/update-stats.ts` | EventBridge rule target |
| `test/lib.test.ts` | Vitest tests for the pure logic |

## Run

```bash
npm install
npx tsc --noEmit
npx vitest run
serverless deploy
# when done – the Kinesis stream costs money even when idle:
serverless remove
```

Tested with Node.js 22, TypeScript 5.9 and Vitest 3. The configuration was validated by packaging it (no deployment).
