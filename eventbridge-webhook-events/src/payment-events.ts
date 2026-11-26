// src/payment-events.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

// This is how the (fictional) payment provider Kassenfuchs sends its webhooks
export interface PaymentEvent {
  id: string;
  type: 'payment.succeeded' | 'payment.refunded';
  createdAt: string;
  data: { paymentId: string; bookingId: string; amountCents: number; currency: string };
}

export type Outcome = 'processed' | 'duplicate' | 'stale' | 'invalid';

const TYPES = new Set(['payment.succeeded', 'payment.refunded']);
const THIRTY_DAYS = 30 * 24 * 60 * 60;

// The body arrives exactly as the provider sent it: validate first, then trust
export const parsePaymentEvent = (raw: unknown): PaymentEvent | undefined => {
  let value: unknown = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (typeof value !== 'object' || value === null) return undefined;
  const e = value as Record<string, unknown>;
  const d = e.data as Record<string, unknown> | undefined;
  const ok =
    typeof e.id === 'string' && e.id.length > 0 && e.id.length <= 128 &&
    typeof e.type === 'string' && TYPES.has(e.type) &&
    typeof e.createdAt === 'string' && !Number.isNaN(Date.parse(e.createdAt)) &&
    typeof d === 'object' && d !== null &&
    typeof d.paymentId === 'string' && typeof d.bookingId === 'string' &&
    Number.isInteger(d.amountCents) && typeof d.currency === 'string';
  return ok ? (value as PaymentEvent) : undefined;
};

export interface Writer {
  send(command: TransactWriteCommand): Promise<unknown>;
}

const reasonCodes = (error: unknown): string[] => {
  const reasons = (error as { CancellationReasons?: { Code?: string }[] }).CancellationReasons ?? [];
  return reasons.map((r) => r.Code ?? 'None');
};

// One event, one transaction: write the marker and update the booking, both or nothing
export const applyEvent = async (db: Writer, table: string, event: PaymentEvent): Promise<Outcome> => {
  const status = event.type === 'payment.succeeded' ? 'PAID' : 'REFUNDED';
  try {
    await db.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: table,
              Item: {
                pk: `EVENT#${event.id}`,
                type: event.type,
                expiresAt: Math.floor(Date.now() / 1000) + THIRTY_DAYS,
              },
              // If the marker already exists, we have processed this event before
              ConditionExpression: 'attribute_not_exists(pk)',
            },
          },
          {
            Update: {
              TableName: table,
              Key: { pk: `BOOKING#${event.data.bookingId}` },
              UpdateExpression:
                'SET paymentStatus = :s, paymentId = :p, amountCents = :a, lastEventAt = :t',
              // Older events never overwrite newer state (ordering is not guaranteed)
              ConditionExpression: 'attribute_not_exists(lastEventAt) OR lastEventAt < :t',
              ExpressionAttributeValues: {
                ':s': status,
                ':p': event.data.paymentId,
                ':a': event.data.amountCents,
                ':t': event.createdAt,
              },
            },
          },
        ],
      }),
    );
    return 'processed';
  } catch (error) {
    if ((error as Error).name !== 'TransactionCanceledException') throw error;
    const [marker, booking] = reasonCodes(error);
    if (marker === 'ConditionalCheckFailed') return 'duplicate';
    if (booking === 'ConditionalCheckFailed') return 'stale';
    throw error;
  }
};

// The subscriber delivers a batch as an array (a single object with MaxBatchSize 1)
export const createHandler = (db: Writer, table: string) => async (input: unknown) => {
  const items = Array.isArray(input) ? input : [input];
  const counts: Record<Outcome, number> = { processed: 0, duplicate: 0, stale: 0, invalid: 0 };

  for (const raw of items) {
    const event = parsePaymentEvent(raw);
    if (!event) {
      // Don't retry broken events forever: log them and move on
      counts.invalid += 1;
      console.warn(JSON.stringify({ msg: 'Skipped invalid payment event' }));
      continue;
    }
    const outcome = await applyEvent(db, table, event);
    counts[outcome] += 1;
    console.log(JSON.stringify({ msg: 'Payment event', id: event.id, type: event.type, outcome }));
  }
  return counts;
};

export const handler = createHandler(
  DynamoDBDocumentClient.from(new DynamoDBClient({})),
  process.env.TABLE_NAME ?? '',
);
