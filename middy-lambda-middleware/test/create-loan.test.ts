// test/create-loan.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { handler } from '../src/handlers/create-loan.js';

const event = (body: unknown, headers: Record<string, string> = {}) =>
  ({
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    isBase64Encoded: false,
  }) as unknown as APIGatewayProxyEventV2;

const context = { getRemainingTimeInMillis: () => 3000 } as unknown as Context;

// The handler is typed with the parsed body; tests send the raw API Gateway event
const invoke = (e: APIGatewayProxyEventV2) => (handler as unknown as (e: unknown, c: Context) => Promise<any>)(e, context);

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('create loan', () => {
  it('creates a loan and returns 201', async () => {
    const res = await invoke(event({ bookId: 'b-42', memberId: 'm-7', days: 14 }));
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).bookId).toBe('b-42');
    expect(res.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reuses an incoming correlation id', async () => {
    const res = await invoke(event({ bookId: 'b-42', memberId: 'm-7', days: 7 }, { 'X-Correlation-Id': 'abc-123' }));
    expect(res.headers['x-correlation-id']).toBe('abc-123');
  });

  it('returns 400 with all problems for an invalid body', async () => {
    const res = await invoke(event({ bookId: '', days: 40 }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).problems).toHaveLength(3);
    expect(res.headers['x-correlation-id']).toBeDefined();
  });

  it('returns 415 for a wrong content type', async () => {
    const res = await invoke(event('hello', { 'Content-Type': 'text/plain' }));
    expect(res.statusCode).toBe(415);
  });

  it('returns 409 for reference books', async () => {
    const res = await invoke(event({ bookId: 'ref-1', memberId: 'm-7', days: 7 }));
    expect(res.statusCode).toBe(409);
    expect(res.body).toBe('Reference books cannot be borrowed');
  });
});
