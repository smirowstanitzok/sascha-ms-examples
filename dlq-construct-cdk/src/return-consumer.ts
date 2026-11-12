// src/return-consumer.ts
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';

const sqs = new SQSClient({});

/** Won't turn out differently on the next attempt: park instead of retrying */
export class PermanentError extends Error {}

interface RentalReturn {
  rentalId: string;
  bikeId: string;
  minutes: number;
}

export function parseReturn(body: string): RentalReturn {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new PermanentError('Not valid JSON');
  }
  const r = data as Partial<RentalReturn>;
  if (typeof r.rentalId !== 'string' || typeof r.bikeId !== 'string') {
    throw new PermanentError('rentalId or bikeId missing');
  }
  if (typeof r.minutes !== 'number' || r.minutes <= 0) {
    throw new PermanentError('minutes must be a positive number');
  }
  return { rentalId: r.rentalId, bikeId: r.bikeId, minutes: r.minutes };
}

export async function chargeRental(ret: RentalReturn): Promise<void> {
  const res = await fetch(process.env.BILLING_URL!, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Same key on every attempt: the API charges only once
      'idempotency-key': ret.rentalId,
    },
    body: JSON.stringify(ret),
    signal: AbortSignal.timeout(5000),
  });
  if (res.ok) return;
  // 429 and 5xx are transient, other 4xx stay wrong on the next attempt too
  if (res.status === 429 || res.status >= 500) {
    throw new Error(`Billing temporarily unavailable: HTTP ${res.status}`);
  }
  throw new PermanentError(`Billing rejected: HTTP ${res.status}`);
}

async function park(record: SQSRecord, reason: string): Promise<void> {
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: process.env.PARKING_QUEUE_URL!,
      MessageBody: record.body,
      MessageAttributes: {
        reason: { DataType: 'String', StringValue: reason.slice(0, 256) },
        originalMessageId: { DataType: 'String', StringValue: record.messageId },
      },
    }),
  );
}

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      await chargeRental(parseReturn(record.body));
    } catch (err) {
      if (err instanceof PermanentError) {
        try {
          await park(record, err.message);
          console.warn(JSON.stringify({ msg: 'parked', messageId: record.messageId, reason: err.message }));
          continue; // parked successfully: let SQS delete it from the queue
        } catch (parkErr) {
          console.error(JSON.stringify({ msg: 'parking failed', messageId: record.messageId }), parkErr);
        }
      } else {
        console.error(JSON.stringify({ msg: 'transient error', messageId: record.messageId }), err);
      }
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}
