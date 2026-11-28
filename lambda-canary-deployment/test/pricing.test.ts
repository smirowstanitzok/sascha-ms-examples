// test/pricing.test.ts
import { describe, expect, it } from 'vitest';
import { calculateRentalPrice } from '../src/pricing.js';
import { handler } from '../src/price-handler.js';
import { checkResponse, SMOKE_TESTS } from '../src/pre-traffic-hook.js';

describe('calculateRentalPrice', () => {
  it('charges the hourly rate for short rentals', () => {
    expect(calculateRentalPrice('kayak', 2)).toBe(1000);
  });

  it('caps a day at six billed hours', () => {
    expect(calculateRentalPrice('canoe', 10)).toBe(4200);
    expect(calculateRentalPrice('sup', 26)).toBe(3200);
  });

  it('rejects invalid hours', () => {
    expect(() => calculateRentalPrice('kayak', 0)).toThrow(RangeError);
  });
});

describe('price handler', () => {
  it('answers 400 for unknown boat types', async () => {
    const res = await handler({ queryStringParameters: { boat: 'yacht', hours: '1' } } as never);
    expect(res).toMatchObject({ statusCode: 400 });
  });

  it('passes all smoke tests of the pre-traffic hook', async () => {
    for (const test of SMOKE_TESTS) {
      const res = await handler({ queryStringParameters: test.query } as never);
      expect(checkResponse(test, res)).toBeNull();
    }
  });
});

describe('checkResponse', () => {
  it('reports a wrong price', () => {
    const problem = checkResponse(SMOKE_TESTS[0], { statusCode: 200, body: '{"priceCents":999}' });
    expect(problem).toMatch(/expected 1000 cents/);
  });
});
