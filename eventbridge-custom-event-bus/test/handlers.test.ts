// test/handlers.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, SQSEvent } from 'aws-lambda';
import type { PutEventsCommand } from '@aws-sdk/client-eventbridgev2';
import { buildEntry, createHandler, type EventSender } from '../src/return-bike.ts';
import { handler as billingHandler, priceInCents } from '../src/billing.ts';
import { handler as maintenanceHandler } from '../src/maintenance.ts';

const ride = {
  returnId: 'r-1001',
  bikeId: 'rad-42',
  customerId: 'customer-7',
  rideKm: 12.5,
  kmSinceService: 640,
  minutes: 38,
};

const envelope = (detail: object) => ({
  version: '0',
  id: 'e-1',
  source: 'radwerk.rental',
  'detail-type': 'BikeReturned',
  account: '111122223333',
  region: 'eu-central-1',
  time: '2026-11-21T10:00:00Z',
  resources: [],
  detail: { ...detail, returnedAt: '2026-11-21T10:00:00.000Z' },
});

const httpEvent = (body: unknown) => ({ body: JSON.stringify(body) }) as APIGatewayProxyEventV2;

const fakeSender = (successCode: 'PUBLISHED' | 'DEDUPLICATED') => {
  const sent: PutEventsCommand[] = [];
  const sender: EventSender = {
    send: async (command) => {
      sent.push(command);
      return { Entries: [{ SuccessCode: successCode, EventId: 'e-1' }], $metadata: {} };
    },
  };
  return { sender, sent };
};

test('buildEntry sets group and deduplication key', () => {
  const entry = buildEntry({ ...ride, returnedAt: '2026-11-21T10:00:00.000Z' });
  assert.equal(entry.SystemMetadata?.EventGroupId, 'customer-7');
  assert.equal(entry.SystemMetadata?.DeduplicationId, 'r-1001');
  assert.equal(entry.DetailType, 'BikeReturned');
});

test('return is published and confirmed with 202', async () => {
  const { sender, sent } = fakeSender('PUBLISHED');
  const handler = createHandler(sender, 'arn:aws:events:eu-central-1:111122223333:event-busv2/test/abc');
  const result = (await handler(httpEvent(ride))) as APIGatewayProxyStructuredResultV2;
  assert.equal(result.statusCode, 202);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].input.Entries?.length, 1);
});

test('duplicate return counts as success', async () => {
  const { sender } = fakeSender('DEDUPLICATED');
  const handler = createHandler(sender, 'arn:test');
  const result = (await handler(httpEvent(ride))) as APIGatewayProxyStructuredResultV2;
  assert.equal(result.statusCode, 202);
  assert.match(String(result.body), /DEDUPLICATED/);
});

test('invalid return is rejected with 400', async () => {
  const { sender, sent } = fakeSender('PUBLISHED');
  const handler = createHandler(sender, 'arn:test');
  const result = (await handler(httpEvent({ bikeId: 'rad-42' }))) as APIGatewayProxyStructuredResultV2;
  assert.equal(result.statusCode, 400);
  assert.equal(sent.length, 0);
});

test('price: base fee plus started minutes', () => {
  assert.equal(priceInCents(38), 670);
  assert.equal(priceInCents(0.5), 115);
});

test('billing reports all following messages after a failure', async () => {
  const sqsEvent = {
    Records: [
      { messageId: 'm1', body: JSON.stringify(envelope(ride)) },
      { messageId: 'm2', body: 'broken' },
      { messageId: 'm3', body: JSON.stringify(envelope(ride)) },
    ],
  } as unknown as SQSEvent;
  const result = await billingHandler(sqsEvent);
  assert.deepEqual(
    result.batchItemFailures.map((f) => f.itemIdentifier),
    ['m2', 'm3'],
  );
});

test('maintenance processes a list and skips unknown events', async () => {
  const result = await maintenanceHandler([envelope(ride), { foo: 'bar' }]);
  assert.deepEqual(result, { scheduled: 1, skipped: 1 });
});
