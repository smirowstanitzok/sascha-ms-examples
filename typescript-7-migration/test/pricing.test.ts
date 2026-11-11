// test/pricing.test.ts
import { describe, expect, it } from 'vitest';
import { rentalPriceCents } from '../src/shared/pricing';

describe('rentalPriceCents', () => {
  it('calculates two hours at the standard rate', () => {
    expect(rentalPriceCents(2)).toBe(900);
  });

  it('rejects a rental duration of zero hours', () => {
    expect(() => rentalPriceCents(0)).toThrow(/positive/);
  });
});
