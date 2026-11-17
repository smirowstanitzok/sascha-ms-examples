// src/quota.ts
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});

/** Key per user and day, e.g. "user-42#2026-11-17" */
export function quotaKey(userId: string, now = new Date()): string {
  return `${userId}#${now.toISOString().slice(0, 10)}`;
}

/**
 * Reserves tokens before the model is called.
 * The condition makes sure that even parallel requests cannot exceed the limit.
 * Returns false when the daily quota is used up.
 */
export async function reserve(
  table: string,
  userId: string,
  tokens: number,
  dailyLimit: number,
): Promise<boolean> {
  try {
    await ddb.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: quotaKey(userId) } },
        UpdateExpression: 'ADD used :n SET expiresAt = if_not_exists(expiresAt, :ttl)',
        ConditionExpression: 'attribute_not_exists(used) OR used <= :rest',
        ExpressionAttributeValues: {
          ':n': { N: String(tokens) },
          ':rest': { N: String(dailyLimit - tokens) },
          // DynamoDB removes entries by itself after two days via TTL
          ':ttl': { N: String(Math.floor(Date.now() / 1000) + 2 * 24 * 3600) },
        },
      }),
    );
    return true;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return false;
    throw error;
  }
}

/** Adjusts the reservation to the tokens actually used (the difference may be negative). */
export async function adjust(table: string, userId: string, difference: number): Promise<void> {
  if (difference === 0) return;
  await ddb.send(
    new UpdateItemCommand({
      TableName: table,
      Key: { pk: { S: quotaKey(userId) } },
      UpdateExpression: 'ADD used :d',
      ExpressionAttributeValues: { ':d': { N: String(difference) } },
    }),
  );
}
