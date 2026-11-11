// test/handler.test.ts
import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { describe, expect, it, vi } from 'vitest';
import { createHandler } from '../src/handler.js';
import { InvalidOrderError, parseOrder } from '../src/order.js';

const record = (messageId: string, body: unknown): SQSRecord => ({
  messageId,
  receiptHandle: `rh-${messageId}`,
  body: typeof body === 'string' ? body : JSON.stringify(body),
  attributes: {
    ApproximateReceiveCount: '1',
    SentTimestamp: '1762848000000',
    SenderId: 'TEST',
    ApproximateFirstReceiveTimestamp: '1762848000000',
  },
  messageAttributes: {},
  md5OfBody: '',
  eventSource: 'aws:sqs',
  eventSourceARN: 'arn:aws:sqs:eu-central-1:123456789012:ticketshop-dev-orders',
  awsRegion: 'eu-central-1',
});

const validOrder = { orderId: 'o-1', eventId: 'concert-42', seats: 2, email: 'kim@example.com' };

describe('parseOrder', () => {
  it('accepts a valid order', () => {
    expect(parseOrder(JSON.stringify(validOrder))).toEqual(validOrder);
  });

  it('rejects broken JSON as a permanent error', () => {
    expect(() => parseOrder('{broken')).toThrow(InvalidOrderError);
  });

  it('rejects too many seats', () => {
    expect(() => parseOrder(JSON.stringify({ ...validOrder, seats: 50 }))).toThrow(/seats/);
  });
});

describe('handler', () => {
  it('reports only the failed messages', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const issueTickets = vi.fn(async (order: { orderId: string }) => {
      if (order.orderId === 'o-3') throw new Error('Ticket API responded with status 503');
    });
    const handler = createHandler(issueTickets);
    const event: SQSEvent = {
      Records: [
        record('m1', validOrder),
        record('m2', '{broken'),
        record('m3', { ...validOrder, orderId: 'o-3' }),
      ],
    };

    const result = await handler(event);

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'm2' }, { itemIdentifier: 'm3' }]);
    expect(issueTickets).toHaveBeenCalledTimes(2);
  });
});
