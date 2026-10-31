// src/receiver.ts
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  ConditionalCheckFailedException,
  DeleteItemCommand,
  DynamoDBClient,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { verifyWebhook } from './signature.ts';
import { getWebhookSecret } from './secret.ts';

const dynamo = new DynamoDBClient({});
const sqs = new SQSClient({});
const TABLE = process.env.INBOX_TABLE!;
const QUEUE_URL = process.env.QUEUE_URL!;
const KEEP_DAYS = 7; // how long we remember a webhook-id

const reply = (statusCode: number, message: string): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ message }),
});

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  if (event.requestContext.http.method !== 'POST') return reply(405, 'method not allowed');

  // 1. Take the raw body exactly as it arrived – do not parse and re-serialize
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
    : (event.body ?? '');

  // 2. Verify signature and timestamp (function URLs deliver lower-case header names)
  const id = event.headers['webhook-id'];
  const check = verifyWebhook({
    secret: await getWebhookSecret(),
    id,
    timestamp: event.headers['webhook-timestamp'],
    signatureHeader: event.headers['webhook-signature'],
    rawBody,
  });
  if (!check.ok) {
    console.warn(JSON.stringify({ level: 'warn', msg: 'webhook rejected', reason: check.reason }));
    return reply(401, 'invalid signature');
  }

  // 3. Detect duplicates: each id may enter the table only once
  const expiresAt = Math.floor(Date.now() / 1000) + KEEP_DAYS * 24 * 60 * 60;
  try {
    await dynamo.send(
      new PutItemCommand({
        TableName: TABLE,
        Item: {
          webhookId: { S: id! },
          status: { S: 'RECEIVED' },
          receivedAt: { S: new Date().toISOString() },
          expiresAt: { N: String(expiresAt) },
        },
        ConditionExpression: 'attribute_not_exists(webhookId)',
      }),
    );
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      // Already known: acknowledge, but do not enqueue again
      return reply(200, 'duplicate');
    }
    throw error;
  }

  // 4. Put the work on the queue and reply right away
  try {
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: rawBody,
        MessageAttributes: { webhookId: { DataType: 'String', StringValue: id! } },
      }),
    );
  } catch (error) {
    // Roll back the entry, otherwise the sender's next retry would look like a duplicate
    await dynamo.send(new DeleteItemCommand({ TableName: TABLE, Key: { webhookId: { S: id! } } }));
    console.error(JSON.stringify({ level: 'error', msg: 'enqueue failed', webhookId: id, error: String(error) }));
    return reply(503, 'try again later');
  }

  return reply(202, 'accepted');
};
