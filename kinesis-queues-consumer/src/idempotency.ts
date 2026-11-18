// src/idempotency.ts
import {
  ConditionalCheckFailedException,
  DeleteItemCommand,
  DynamoDBClient,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';

export type ClaimResult = 'claimed' | 'done' | 'busy';

export interface IdempotencyStore {
  claim(key: string): Promise<ClaimResult>;
  complete(key: string): Promise<void>;
  release(key: string): Promise<void>;
}

/**
 * Claim with a lease: whoever claims first may work on the key.
 * If a worker crashes, the lease expires and the next delivery takes over.
 */
export class DynamoIdempotencyStore implements IdempotencyStore {
  constructor(
    private readonly client: DynamoDBClient,
    private readonly tableName: string,
    private readonly leaseSeconds = 60,
    private readonly keepDays = 7,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async claim(key: string): Promise<ClaimResult> {
    const nowSec = Math.floor(this.now() / 1000);
    try {
      await this.client.send(
        new UpdateItemCommand({
          TableName: this.tableName,
          Key: { pk: { S: key } },
          UpdateExpression: 'SET #s = :pending, leaseUntil = :lease, expiresAt = :ttl',
          ConditionExpression: 'attribute_not_exists(pk) OR (#s = :pending AND leaseUntil < :now)',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':pending': { S: 'PENDING' },
            ':lease': { N: String(nowSec + this.leaseSeconds) },
            ':ttl': { N: String(nowSec + this.keepDays * 86_400) },
            ':now': { N: String(nowSec) },
          },
          ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
        }),
      );
      return 'claimed';
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        return error.Item?.status?.S === 'DONE' ? 'done' : 'busy';
      }
      throw error;
    }
  }

  async complete(key: string): Promise<void> {
    await this.client.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: { pk: { S: key } },
        UpdateExpression: 'SET #s = :done REMOVE leaseUntil',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':done': { S: 'DONE' } },
      }),
    );
  }

  async release(key: string): Promise<void> {
    await this.client.send(
      new DeleteItemCommand({
        TableName: this.tableName,
        Key: { pk: { S: key } },
        ConditionExpression: '#s = :pending',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':pending': { S: 'PENDING' } },
      }),
    ).catch(() => undefined); // lease expires anyway
  }
}
