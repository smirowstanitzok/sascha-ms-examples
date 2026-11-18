// test/concurrency.test.ts
// Simulates multi-concurrency locally: many invocations run at the same time in the same
// Node.js process – just like in a worker thread on Lambda Managed Instances.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { OrderEvent, Receipt } from '../src/shop.js';
import { priceListLoadCount, resetPriceListLoadCount } from '../src/shop.js';
import { handler as unsafeHandler } from '../src/handler-unsafe.js';
import { handler as safeHandler } from '../src/handler.js';
import { once } from '../src/once.js';

type Handler = (event: OrderEvent, context: { awsRequestId: string }) => Promise<Receipt>;

function makeOrder(i: number): OrderEvent {
  return { orderId: `order-${i}`, customerId: `customer-${i}`, seats: [{ category: 'circle', count: i + 1 }] };
}

// Calls the handler n times concurrently and counts responses that don't match their own request
async function countMixUps(handler: Handler, n = 50): Promise<number> {
  const results = await Promise.all(
    Array.from({ length: n }, (_, i) => handler(makeOrder(i), { awsRequestId: `req-${i}` })),
  );
  return results.filter((r, i) =>
    r.orderId !== `order-${i}` ||
    r.customerId !== `customer-${i}` ||
    r.requestId !== `req-${i}` ||
    r.totalCents !== 4900 * (i + 1),
  ).length;
}

test('unsafe handler mixes up data under concurrent invocations', async () => {
  const mixUps = await countMixUps(unsafeHandler);
  assert.ok(mixUps > 0, 'expected: at least one mixed-up response');
});

test('safe handler returns its own data to every invocation', async () => {
  for (let round = 0; round < 5; round++) {
    assert.equal(await countMixUps(safeHandler), 0);
  }
});

test('once() loads the price list exactly once, even with 50 concurrent invocations', async () => {
  resetPriceListLoadCount();
  const { loadPriceList } = await import('../src/shop.js');
  const getPrices = once(loadPriceList);
  await Promise.all(Array.from({ length: 50 }, () => getPrices()));
  assert.equal(priceListLoadCount(), 1);
});

test('once() retries after a failure', async () => {
  let calls = 0;
  const flaky = once(async () => {
    calls++;
    if (calls === 1) throw new Error('database unreachable');
    return 'ok';
  });
  await assert.rejects(flaky(), /unreachable/);
  assert.equal(await flaky(), 'ok');
  assert.equal(calls, 2);
});
