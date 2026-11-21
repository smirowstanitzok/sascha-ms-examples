// src/connections.ts
import {
  DeleteCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';

// API Gateway keeps a connection open for 2 hours at most.
// A 3-hour TTL lets DynamoDB also remove entries whose $disconnect never arrived.
const TTL_SECONDS = 3 * 60 * 60;

export interface ConnectionStore {
  add(connectionId: string, matchId: string): Promise<void>;
  remove(connectionId: string): Promise<void>;
  listByMatch(matchId: string): Promise<string[]>;
}

export function createConnectionStore(
  doc: DynamoDBDocumentClient,
  tableName: string,
): ConnectionStore {
  return {
    async add(connectionId, matchId) {
      await doc.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            connectionId,
            matchId,
            expiresAt: Math.floor(Date.now() / 1000) + TTL_SECONDS,
          },
        }),
      );
    },

    async remove(connectionId) {
      await doc.send(
        new DeleteCommand({ TableName: tableName, Key: { connectionId } }),
      );
    },

    async listByMatch(matchId) {
      const ids: string[] = [];
      let startKey: Record<string, unknown> | undefined;
      do {
        const page = await doc.send(
          new QueryCommand({
            TableName: tableName,
            IndexName: 'byMatch',
            KeyConditionExpression: 'matchId = :m',
            ExpressionAttributeValues: { ':m': matchId },
            ProjectionExpression: 'connectionId',
            ExclusiveStartKey: startKey,
          }),
        );
        for (const item of page.Items ?? []) ids.push(item.connectionId as string);
        startKey = page.LastEvaluatedKey;
      } while (startKey);
      return ids;
    },
  };
}
