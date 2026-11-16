// src/handlers/create-invoice.ts
import type { EventBridgeEvent, SQSBatchResponse, SQSEvent } from "aws-lambda";
import type { RentalEndedDetail } from "../lib/events.js";
import { priceInCents } from "../lib/tariff.js";

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];

  for (const message of event.Records) {
    try {
      // EventBridge puts the complete event as JSON into the message body
      const rentalEvent = JSON.parse(message.body) as EventBridgeEvent<"RentalEnded", RentalEndedDetail>;
      const { rentalId, customerId, startedAt, endedAt } = rentalEvent.detail;
      const amount = priceInCents(startedAt, endedAt);

      // This is where you would store the invoice idempotently, e.g. keyed by rentalId
      console.log("Invoice created", { rentalId, customerId, amountCents: amount });
    } catch (err) {
      console.error("Invoice failed", { messageId: message.messageId, err });
      batchItemFailures.push({ itemIdentifier: message.messageId });
    }
  }

  return { batchItemFailures };
};
