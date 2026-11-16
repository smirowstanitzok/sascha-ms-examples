// src/handlers/process-telemetry.ts
import type { KinesisStreamEvent, KinesisStreamBatchResponse } from "aws-lambda";
import { LOW_BATTERY_PERCENT, latestPerBike, type Telemetry } from "../lib/telemetry.js";

export const handler = async (event: KinesisStreamEvent): Promise<KinesisStreamBatchResponse> => {
  const items: Telemetry[] = [];

  for (const record of event.Records) {
    try {
      const json = Buffer.from(record.kinesis.data, "base64").toString("utf8");
      items.push(JSON.parse(json) as Telemetry);
    } catch {
      // Broken record: log and skip it, otherwise it blocks the shard
      console.warn("Record skipped", { sequenceNumber: record.kinesis.sequenceNumber });
    }
  }

  try {
    for (const [bikeId, latest] of latestPerBike(items)) {
      if (latest.batteryPercent < LOW_BATTERY_PERCENT) {
        console.log("Battery almost empty – flag bike for a swap", {
          bikeId,
          batteryPercent: latest.batteryPercent,
        });
      }
    }
  } catch (err) {
    // With Kinesis, everything from the reported sequence number onwards is redelivered
    const first = event.Records[0]?.kinesis.sequenceNumber;
    console.error("Processing failed", err);
    return { batchItemFailures: first ? [{ itemIdentifier: first }] : [] };
  }

  return { batchItemFailures: [] };
};
