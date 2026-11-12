// test/return-consumer.test.ts
import type { SQSEvent } from 'aws-lambda';
import { describe, expect, it, vi } from 'vitest';
import { PermanentError, handler, parseReturn } from '../src/return-consumer.js';

describe('parseReturn', () => {
  it('parses a valid return', () => {
    expect(parseReturn('{"rentalId":"r-1","bikeId":"b-7","minutes":42}').minutes).toBe(42);
  });

  it('throws PermanentError for broken JSON', () => {
    expect(() => parseReturn('{broken')).toThrow(PermanentError);
  });

  it('throws PermanentError for a negative duration', () => {
    expect(() => parseReturn('{"rentalId":"r-1","bikeId":"b-7","minutes":-3}')).toThrow(/positive number/);
  });
});

describe('handler', () => {
  it('reports HTTP 503 as a partial failure', async () => {
    process.env.BILLING_URL = 'https://billing.example.com/rentals';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 503 })));
    const event = {
      Records: [{ messageId: 'm-1', body: '{"rentalId":"r-1","bikeId":"b-7","minutes":42}' }],
    } as unknown as SQSEvent;
    await expect(handler(event)).resolves.toEqual({ batchItemFailures: [{ itemIdentifier: 'm-1' }] });
    vi.unstubAllGlobals();
  });
});
