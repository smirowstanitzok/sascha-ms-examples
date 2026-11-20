// src/dynamo-checkpoint-store.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { CheckpointState, CheckpointStore } from './checkpoint-store.ts';

const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

export class DynamoCheckpointStore implements CheckpointStore {
  private readonly doc: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(tableName: string, client: DynamoDBClient = new DynamoDBClient({})) {
    this.tableName = tableName;
    this.doc = DynamoDBDocumentClient.from(client);
  }

  async load(orderId: string): Promise<CheckpointState> {
    const { Item } = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { orderId }, ConsistentRead: true }),
    );
    if (!Item) return { nextPage: 1, done: false };
    return { nextPage: Number(Item.nextPage), done: Item.status === 'done' };
  }

  async save(orderId: string, nextPage: number): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { orderId, nextPage, status: 'running', expiresAt: expiresAt() },
      }),
    );
  }

  async finish(orderId: string): Promise<void> {
    await this.doc.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { orderId },
        UpdateExpression: 'SET #s = :done, expiresAt = :exp',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':done': 'done', ':exp': expiresAt() },
      }),
    );
  }
}

// Old checkpoints are removed automatically by DynamoDB TTL
function expiresAt(): number {
  return Math.floor(Date.now() / 1000) + SEVEN_DAYS_IN_SECONDS;
}
