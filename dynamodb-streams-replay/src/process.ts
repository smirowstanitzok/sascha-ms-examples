import type { _Record as StreamRecord } from "@aws-sdk/client-dynamodb-streams";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

/** The actual business logic – used by the live trigger AND by the replay. Must be idempotent! */
export async function processRecords(records: StreamRecord[]): Promise<void> {
  for (const record of records) {
    const image = record.dynamodb?.NewImage
      ? unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>)
      : undefined;
    console.log(JSON.stringify({
      eventId: record.eventID,
      type: record.eventName,
      at: record.dynamodb?.ApproximateCreationDateTime?.toISOString(),
      item: image,
    }));
  }
}
