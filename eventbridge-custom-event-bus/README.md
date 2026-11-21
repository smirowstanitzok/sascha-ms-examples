# EventBridge custom event bus: retention, FIFO, replay

Example code for the article [EventBridge custom event bus: retention, FIFO, replay](https://sascha-ms.de/en/eventbridge-custom-event-bus) (German version: [EventBridge Custom Event Bus: Retention, FIFO, Replay](https://sascha-ms.de/2026/3871-eventbridge-custom-event-bus)).

A fictional bike rental called "Radwerk" reports every bike return through an HTTP API. The return is published as a `BikeReturned` event to the new EventBridge custom event bus (September 2026), with the customer ID as `EventGroupId` and the return ID as `DeduplicationId`. Three subscribers consume it:

- **billing**: FIFO subscriber that delivers all returns in order per customer to an SQS FIFO queue and a billing Lambda
- **maintenance**: numeric filter (`kmSinceService >= 500`) that invokes a Lambda function directly (the function receives a list of events)
- **stats**: subscriber with `StartingPosition: POINT_IN_TIME` / `HORIZON` that also reads all retained events from before it was created

## Files

| File | Purpose |
| --- | --- |
| `src/events.ts` | Zod schemas for the event payload and the delivered envelope |
| `src/return-bike.ts` | HTTP handler that publishes with `PutEventsCommand` from `@aws-sdk/client-eventbridgev2` |
| `src/billing.ts` | SQS FIFO consumer with partial batch responses that keep the order |
| `src/maintenance.ts` | Lambda target that handles a list of events |
| `serverless.yml` | Serverless Framework v4: bus (`AWS::EventsV2::EventBus`), queues, delivery role, three subscribers (`AWS::EventsV2::Subscriber`) |
| `test/handlers.test.ts` | Tests with the built-in Node.js test runner |

## Run

```bash
npm install
npm run typecheck
npm test                       # node --test with built-in type stripping
serverless deploy --stage dev  # needs AWS credentials and a Serverless Framework login
```

Then report a return (replace the URL with the `endpoint` from the deploy output):

```bash
curl -s -X POST "$API_URL/returns" -H 'content-type: application/json' \
  -d '{"returnId":"r-1001","bikeId":"rad-42","customerId":"customer-7","rideKm":12.5,"kmSinceService":640,"minutes":38}'
```

Sending the same request again within five minutes returns `"status":"DEDUPLICATED"`.

The new bus is only available in some regions (at launch fourteen, including `eu-central-1`). Deploying creates billable resources (EventBridge, SQS, Lambda, API Gateway). Run `serverless remove --stage dev` when you are done.

## Tested with

Node.js 22.23 (tests), TypeScript 5.9, @aws-sdk/client-eventbridgev2 3.1175.0, zod 4.6. The CloudFormation properties were checked against the `aws_eventsv2` L1 types of aws-cdk-lib 2.278.0. The stack itself was not deployed while writing the article.
