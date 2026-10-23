import type { DynamoDBStreamEvent, DynamoDBBatchResponse } from "aws-lambda";
import type { _Record as StreamRecord } from "@aws-sdk/client-dynamodb-streams";
import { processRecords } from "./process";

export const handler = async (event: DynamoDBStreamEvent): Promise<DynamoDBBatchResponse> => {
  const failures: DynamoDBBatchResponse["batchItemFailures"] = [];
  for (const record of event.Records) {
    try {
      // Lambda delivers ApproximateCreationDateTime as a number (seconds) – convert to Date for the shared logic
      const seconds = record.dynamodb?.ApproximateCreationDateTime;
      await processRecords([{
        ...record,
        dynamodb: { ...record.dynamodb, ApproximateCreationDateTime: seconds ? new Date(seconds * 1000) : undefined },
      } as StreamRecord]);
    } catch {
      failures.push({ itemIdentifier: record.dynamodb!.SequenceNumber! });
      break; // preserve order: have Lambda redeliver from here
    }
  }
  return { batchItemFailures: failures };
};
