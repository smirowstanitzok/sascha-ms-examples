// src/dedupe.ts
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});
const TTL_SECONDS = 2 * 24 * 60 * 60; // two days are enough for duplicates

// Returns true if the key is new, otherwise false (duplicate).
export async function firstTime(tableName: string, key: string): Promise<boolean> {
  try {
    await ddb.send(
      new PutItemCommand({
        TableName: tableName,
        Item: {
          pk: { S: key },
          expiresAt: { N: String(Math.floor(Date.now() / 1000) + TTL_SECONDS) },
        },
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    );
    return true;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return false;
    throw err;
  }
}
