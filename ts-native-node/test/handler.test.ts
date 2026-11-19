// test/handler.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quote } from '../src/handler.ts';

test('returns a price for a valid request', async () => {
  const res = await quote({ body: JSON.stringify({ id: 'q1', bike: 'ebike', hours: 2, member: false }) });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { id: 'q1', cent: 1200, label: '12,00 €' });
});

test('rejects unknown bike types with 422', async () => {
  const res = await quote({ body: JSON.stringify({ id: 'q2', bike: 'tandem', hours: 1, member: false }) });
  assert.equal(res.statusCode, 422);
});

test('rejects broken JSON with 400', async () => {
  const res = await quote({ body: '{broken' });
  assert.equal(res.statusCode, 400);
});
