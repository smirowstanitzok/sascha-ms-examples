// src/handlers/update-stats.ts
import type { EventBridgeEvent } from "aws-lambda";
import type { RentalEndedDetail } from "../lib/events.js";

export const handler = async (event: EventBridgeEvent<"RentalEnded", RentalEndedDetail>) => {
  const minutes = Math.ceil(
    (Date.parse(event.detail.endedAt) - Date.parse(event.detail.startedAt)) / 60_000,
  );
  // Statistics are just an example – in real life e.g. a counter in DynamoDB
  console.log("Ride counted", { bikeId: event.detail.bikeId, minutes });
};
