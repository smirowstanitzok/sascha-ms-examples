// src/payment-events.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler, parsePaymentEvent } from './payment-events.ts';
import { signWebhook, signingKey } from './standard-webhooks.ts';

const event = {
  id: 'evt_1001',
  type: 'payment.succeeded',
  createdAt: '2026-11-26T10:15:00Z',
  data: { paymentId: 'pay_77', bookingId: 'B-1042', amountCents: 1250, currency: 'EUR' },
};

// Small DynamoDB stand-in: remembers markers and booking state
const fakeDb = () => {
  const markers = new Set<string>();
  const bookings = new Map<string, string>();
  return {
    bookings,
    async send(command: TransactWriteCommand) {
      const [put, update] = command.input.TransactItems ?? [];
      const pk = put?.Put?.Item?.pk as string;
      const key = update?.Update?.Key?.pk as string;
      const at = update?.Update?.ExpressionAttributeValues?.[':t'] as string;
      const markerFails = markers.has(pk);
      const bookingFails = !markerFails && bookings.has(key) && (bookings.get(key) as string) >= at;
      if (markerFails || bookingFails) {
        const error = new Error('cancelled') as Error & { CancellationReasons: { Code: string }[] };
        error.name = 'TransactionCanceledException';
        error.CancellationReasons = [
          { Code: markerFails ? 'ConditionalCheckFailed' : 'None' },
          { Code: bookingFails ? 'ConditionalCheckFailed' : 'None' },
        ];
        throw error;
      }
      markers.add(pk);
      bookings.set(key, at);
      return {};
    },
  };
};

test('processes an event exactly once, even if it arrives twice', async () => {
  const handler = createHandler(fakeDb(), 'payments');
  const result = await handler([event, event]);
  assert.deepEqual(result, { processed: 1, duplicate: 1, stale: 0, invalid: 0 });
});

test('ignores an older event that arrives after a newer one', async () => {
  const handler = createHandler(fakeDb(), 'payments');
  const newer = { ...event, id: 'evt_1002', type: 'payment.refunded', createdAt: '2026-11-26T11:00:00Z' };
  const result = await handler([newer, event]);
  assert.deepEqual(result, { processed: 1, duplicate: 0, stale: 1, invalid: 0 });
});

test('accepts a single object and JSON strings', async () => {
  const handler = createHandler(fakeDb(), 'payments');
  assert.equal((await handler(event)).processed, 1);
  assert.ok(parsePaymentEvent(JSON.stringify(event)));
});

test('skips invalid events instead of blocking the batch', async () => {
  const handler = createHandler(fakeDb(), 'payments');
  const result = await handler([{ id: 'x' }, 'not json', event]);
  assert.deepEqual(result, { processed: 1, duplicate: 0, stale: 0, invalid: 2 });
});

test('signs according to Standard Webhooks (id.timestamp.body, base64)', () => {
  const secret = 'whsec_' + Buffer.from('a-very-secret-signing-key').toString('base64');
  const body = JSON.stringify(event);
  const headers = signWebhook(secret, 'msg_1', body, 1764150000);
  const expected = createHmac('sha256', signingKey(secret)).update(`msg_1.1764150000.${body}`).digest('base64');
  assert.equal(headers['webhook-signature'], `v1,${expected}`);
  assert.match(headers['webhook-signature'], /^v1,[A-Za-z0-9+/]+=*$/);
  assert.equal(headers['webhook-timestamp'], '1764150000');
});
