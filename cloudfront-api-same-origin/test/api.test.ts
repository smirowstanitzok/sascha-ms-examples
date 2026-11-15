// test/api.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from '../functions/api';

const event = (method: string, path: string, cookies?: string[]) =>
  ({
    rawPath: path,
    cookies,
    requestContext: { http: { method } },
  }) as unknown as APIGatewayProxyEventV2;

test('returns books for /api/books', async () => {
  const res = await handler(event('GET', '/api/books'));
  assert.equal(res.statusCode, 200);
  assert.match(String(res.body), /Serverless Garden/);
});

test('sets a SameSite=Strict cookie on POST /api/session', async () => {
  const res = await handler(event('POST', '/api/session'));
  assert.equal(res.statusCode, 201);
  assert.match(res.cookies?.[0] ?? '', /SameSite=Strict/);
});

test('reads the cookie on GET /api/me', async () => {
  const res = await handler(event('GET', '/api/me', ['reader=reader-abc123']));
  assert.equal(res.statusCode, 200);
  assert.match(String(res.body), /reader-abc123/);
});

test('returns 401 without a cookie', async () => {
  const res = await handler(event('GET', '/api/me'));
  assert.equal(res.statusCode, 401);
});
