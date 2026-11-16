// src/handlers/end-rental.ts
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { RENTAL_ENDED, RENTAL_SOURCE, type RentalEndedDetail } from "../lib/events.js";

const eventBridge = new EventBridgeClient({});

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const rentalId = event.pathParameters?.rentalId ?? "";
  const body = JSON.parse(event.body ?? "{}") as Partial<RentalEndedDetail>;

  if (!rentalId || !body.bikeId || !body.customerId || !body.startedAt) {
    return { statusCode: 400, body: JSON.stringify({ message: "bikeId, customerId and startedAt are missing" }) };
  }

  const detail: RentalEndedDetail = {
    rentalId,
    bikeId: body.bikeId,
    customerId: body.customerId,
    startedAt: body.startedAt,
    endedAt: body.endedAt ?? new Date().toISOString(),
  };

  const result = await eventBridge.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: process.env.EVENT_BUS,
          Source: RENTAL_SOURCE,
          DetailType: RENTAL_ENDED,
          Detail: JSON.stringify(detail),
        },
      ],
    }),
  );

  // PutEvents reports partial failures in the result, not as an exception
  if (result.FailedEntryCount && result.FailedEntryCount > 0) {
    console.error("Event not accepted", result.Entries?.[0]);
    return { statusCode: 503, body: JSON.stringify({ message: "Please try again later" }) };
  }
  return { statusCode: 202, body: JSON.stringify({ rentalId, eventId: result.Entries?.[0]?.EventId }) };
};
