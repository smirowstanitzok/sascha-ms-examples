// test/cors-check.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { checkPreflight, evaluatePreflight, type PreflightRequest } from '../src/cors-check.ts';

const base: PreflightRequest = {
  url: 'http://unused',
  origin: 'https://app.bike-rental.example',
  method: 'POST',
  headers: ['content-type', 'authorization'],
  credentials: false,
};

const good = new Headers({
  'access-control-allow-origin': 'https://app.bike-rental.example',
  'access-control-allow-methods': 'GET,POST',
  'access-control-allow-headers': 'content-type,authorization',
  'access-control-max-age': '3600',
  vary: 'Origin',
});

test('complete preflight response has no findings', () => {
  assert.deepEqual(evaluatePreflight(base, 204, good), []);
});

test('missing header is reported', () => {
  const h = new Headers(good);
  h.set('access-control-allow-headers', 'content-type');
  const messages = evaluatePreflight(base, 204, h).map((f) => f.message);
  assert.match(messages.join(' '), /"authorization" is not in Access-Control-Allow-Headers/);
});

test('wildcard does not cover Authorization', () => {
  const h = new Headers(good);
  h.set('access-control-allow-headers', '*');
  const errors = evaluatePreflight(base, 204, h).filter((f) => f.level === 'error');
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /authorization/);
});

test('credentials with wildcard origin is an error', () => {
  const h = new Headers(good);
  h.set('access-control-allow-origin', '*');
  h.set('access-control-allow-credentials', 'true');
  const messages = evaluatePreflight({ ...base, credentials: true }, 204, h).map((f) => f.message);
  assert.match(messages.join(' '), /"\*" is not allowed/);
});

test('duplicate origin values point to double configuration', () => {
  const h = new Headers(good);
  h.set('access-control-allow-origin', '*, *');
  const messages = evaluatePreflight(base, 204, h).map((f) => f.message);
  assert.match(messages.join(' '), /multiple values/);
});

test('checkPreflight sends a real OPTIONS request with Origin', async () => {
  const server = createServer((req, res) => {
    const origin = req.headers.origin ?? '';
    res.writeHead(req.method === 'OPTIONS' ? 204 : 405, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET,POST',
      'Access-Control-Allow-Headers': 'content-type',
      Vary: 'Origin',
    });
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const findings = await checkPreflight({ ...base, url: `http://127.0.0.1:${port}/bookings` });
    const messages = findings.map((f) => f.message).join(' ');
    assert.match(messages, /"authorization" is not in/);
    assert.match(messages, /No Access-Control-Max-Age/);
  } finally {
    server.close();
  }
});
