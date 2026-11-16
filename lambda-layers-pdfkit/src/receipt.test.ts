// src/receipt.test.ts
import { describe, expect, it } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler, priceInEuro } from './receipt';

const request = (rentalId: string) =>
  ({ pathParameters: { rentalId } }) as unknown as APIGatewayProxyEventV2;

describe('receipt', () => {
  it('calculates the price in euro', () => {
    expect(priceInEuro({ id: 'x', bike: 'y', minutes: 95, centsPerMinute: 4 })).toBe('3.80');
  });

  it('returns a PDF for a known rental', async () => {
    const response = await handler(request('R-1001'));
    if (typeof response === 'string') throw new Error('unexpected response');
    expect(response.statusCode).toBe(200);
    const pdf = Buffer.from(response.body ?? '', 'base64');
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('returns 404 for an unknown rental', async () => {
    const response = await handler(request('R-9999'));
    if (typeof response === 'string') throw new Error('unexpected response');
    expect(response.statusCode).toBe(404);
  });
});
