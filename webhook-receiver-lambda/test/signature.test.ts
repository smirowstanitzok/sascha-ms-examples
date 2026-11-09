// test/signature.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeSignature, verifyWebhook } from '../src/signature.ts';

const secret = 'whsec_' + Buffer.from('a-secret-with-enough-characters-123').toString('base64');
const id = 'msg_2Kx7';
const timestamp = '1793404800';
const rawBody = '{"type":"payment.succeeded","data":{"rentalId":"R-1042","amountCents":1890}}';
const now = 1793404800;

test('accepts a valid signature', () => {
  const signatureHeader = `v1,${computeSignature(secret, id, timestamp, rawBody)}`;
  assert.deepEqual(verifyWebhook({ secret, id, timestamp, signatureHeader, rawBody, nowSeconds: now }), { ok: true });
});

test('accepts the second signature during a rotation', () => {
  const signatureHeader = `v1,AAAA v1,${computeSignature(secret, id, timestamp, rawBody)}`;
  assert.equal(verifyWebhook({ secret, id, timestamp, signatureHeader, rawBody, nowSeconds: now }).ok, true);
});

test('rejects a tampered body', () => {
  const signatureHeader = `v1,${computeSignature(secret, id, timestamp, rawBody)}`;
  const tampered = rawBody.replace('1890', '1');
  assert.deepEqual(verifyWebhook({ secret, id, timestamp, signatureHeader, rawBody: tampered, nowSeconds: now }), {
    ok: false,
    reason: 'bad-signature',
  });
});

test('rejects a timestamp that is too old', () => {
  const signatureHeader = `v1,${computeSignature(secret, id, timestamp, rawBody)}`;
  const result = verifyWebhook({ secret, id, timestamp, signatureHeader, rawBody, nowSeconds: now + 600 });
  assert.deepEqual(result, { ok: false, reason: 'too-old' });
});

test('rejects missing headers', () => {
  const result = verifyWebhook({ secret, id: undefined, timestamp, signatureHeader: 'v1,x', rawBody, nowSeconds: now });
  assert.deepEqual(result, { ok: false, reason: 'missing-headers' });
});
