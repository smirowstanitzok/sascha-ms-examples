// src/store.ts
// Small abstraction over DynamoDB so the handlers stay testable without AWS.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

export type UploadStatus = "OPEN" | "COMPLETED" | "ABORTED";

export interface UploadRecord {
  id: string;
  s3UploadId: string;
  key: string;
  contentType: string;
  size: number;
  partSize: number;
  partCount: number;
  status: UploadStatus;
  expiresAt: number; // Unix seconds, DynamoDB TTL removes old items
}

export interface UploadStore {
  put(record: UploadRecord): Promise<void>;
  get(id: string): Promise<UploadRecord | undefined>;
  // Sets the status only while the upload is still open; returns false otherwise
  close(id: string, status: Exclude<UploadStatus, "OPEN">): Promise<boolean>;
}

export function dynamoStore(tableName: string, client = new DynamoDBClient({})): UploadStore {
  const doc = DynamoDBDocumentClient.from(client);
  return {
    async put(record) {
      await doc.send(
        new PutCommand({
          TableName: tableName,
          Item: record,
          ConditionExpression: "attribute_not_exists(id)",
        }),
      );
    },
    async get(id) {
      const res = await doc.send(new GetCommand({ TableName: tableName, Key: { id } }));
      return res.Item as UploadRecord | undefined;
    },
    async close(id, status) {
      try {
        await doc.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { id },
            UpdateExpression: "SET #s = :new",
            ConditionExpression: "#s = :open",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: { ":new": status, ":open": "OPEN" },
          }),
        );
        return true;
      } catch (err) {
        if ((err as Error).name === "ConditionalCheckFailedException") return false;
        throw err;
      }
    },
  };
}
