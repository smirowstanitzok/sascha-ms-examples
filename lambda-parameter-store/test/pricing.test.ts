// test/pricing.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quotePrice } from '../src/pricing.js';
import { parseConfig } from '../src/config.js';

const base = '/bike-rental/test';
const config = { pricePerHourCents: 450, rentalPaused: false };

test('every started hour is billed', () => {
  assert.deepEqual(quotePrice(2.25, config), { ok: true, hours: 3, totalCents: 1350 });
});

test('paused rental returns a reason', () => {
  const result = quotePrice(1, { ...config, rentalPaused: true });
  assert.equal(result.ok, false);
});

test('more than 72 hours is rejected', () => {
  assert.equal(quotePrice(73, config).ok, false);
});

test('parseConfig turns strings into types', () => {
  const parsed = parseConfig(
    {
      [`${base}/price-per-hour-cents`]: '450',
      [`${base}/rental-paused`]: 'FALSE',
      [`${base}/payment-api-key`]: 'abc',
    },
    base,
  );
  assert.deepEqual(parsed, { pricePerHourCents: 450, rentalPaused: false, paymentApiKey: 'abc' });
});

test('parseConfig rejects an invalid price', () => {
  assert.throws(
    () => parseConfig({ [`${base}/price-per-hour-cents`]: 'free' }, base),
    /positive integer/,
  );
});
