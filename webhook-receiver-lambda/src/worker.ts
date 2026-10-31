// src/worker.ts
import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';

const dynamo = new DynamoDBClient({});
const TABLE = process.env.INBOX_TABLE!;

type PaymentEvent = {
  type: 'payment.succeeded' | 'payment.failed' | string;
  data: { rentalId: string; amountCents: number };
};

// The actual business logic – in this example: mark a bike rental as paid
async function handlePaymentEvent(event: PaymentEvent): Promise<void> {
  if (event.type === 'payment.succeeded') {
    console.log(JSON.stringify({ msg: 'rental paid', rentalId: event.data.rentalId, amountCents: event.data.amountCents }));
  } else {
    console.log(JSON.stringify({ msg: 'ignored event type', type: event.type }));
  }
}

async function processRecord(record: SQSRecord): Promise<void> {
  const webhookId = record.messageAttributes.webhookId?.stringValue;
  if (!webhookId) throw new Error('webhookId missing');

  // SQS delivers at least once: skip messages that are already done
  const current = await dynamo.send(
    new GetItemCommand({ TableName: TABLE, Key: { webhookId: { S: webhookId } }, ConsistentRead: true }),
  );
  if (current.Item?.status?.S === 'PROCESSED') return;

  // The business logic must still be idempotent (setting "paid" twice does no harm)
  await handlePaymentEvent(JSON.parse(record.body) as PaymentEvent);

  // Mark as done; if the condition fails, another invocation was faster
  try {
    await dynamo.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: { webhookId: { S: webhookId } },
        UpdateExpression: 'SET #s = :done, processedAt = :now',
        ConditionExpression: '#s <> :done',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':done': { S: 'PROCESSED' }, ':now': { S: new Date().toISOString() } },
      }),
    );
  } catch (error) {
    if (!(error instanceof ConditionalCheckFailedException)) throw error;
  }
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];
  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (error) {
      console.error(JSON.stringify({ msg: 'processing failed', messageId: record.messageId, error: String(error) }));
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
};
