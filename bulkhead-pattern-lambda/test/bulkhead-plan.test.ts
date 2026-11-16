// test/bulkhead-plan.test.ts
import { describe, expect, it } from 'vitest';
import { checkPlan } from '../src/bulkhead-plan.ts';

describe('checkPlan', () => {
  it('accepts a sensible plan', () => {
    const r = checkPlan(1000, [
      { name: 'payment', partnerLimit: 20, reservedConcurrency: 12, maxConcurrency: 10 },
      { name: 'sms', partnerLimit: 5, reservedConcurrency: 5, maxConcurrency: 4 },
    ]);
    expect(r.ok).toBe(true);
    expect(r.unreservedLeft).toBe(983);
  });

  it('rejects maxConcurrency above reserved concurrency', () => {
    const r = checkPlan(1000, [{ name: 'sms', partnerLimit: 10, reservedConcurrency: 5, maxConcurrency: 8 }]);
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toMatch(/will throttle/);
  });

  it('rejects more parallel calls than the partner accepts', () => {
    const r = checkPlan(1000, [{ name: 'lock', partnerLimit: 3, reservedConcurrency: 8, maxConcurrency: 6 }]);
    expect(r.problems.some((p) => p.includes('partner limit'))).toBe(true);
  });

  it('keeps 100 units unreserved', () => {
    const r = checkPlan(1000, [{ name: 'batch', partnerLimit: 1000, reservedConcurrency: 950, maxConcurrency: 900 }]);
    expect(r.problems.some((p) => p.includes('reservable maximum (900)'))).toBe(true);
  });

  it('warns about small reservations and a shrinking shared pool', () => {
    const r = checkPlan(100, [{ name: 'sms', partnerLimit: 5, reservedConcurrency: 3, maxConcurrency: 2 }], 50);
    expect(r.warnings.length).toBe(2);
  });
});
