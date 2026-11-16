// test/simulation.test.ts
import { describe, expect, it } from 'vitest';
import { bookingWave, simulate } from '../src/simulation.ts';

describe('simulate', () => {
  const jobs = bookingWave(200, { payment: 400, lock: 300, sms: 2500 });

  it('lets a hanging partner slow down everyone in a shared pool', () => {
    const shared = simulate(jobs, 20);
    expect(shared.payment.maxWaitMs).toBeGreaterThan(5000);
  });

  it('keeps payments flowing with one pool per partner', () => {
    const isolated = simulate(jobs, { payment: 10, lock: 6, sms: 4 });
    expect(isolated.payment.maxWaitMs).toBe(0);
    expect(isolated.lock.maxWaitMs).toBe(0);
    expect(isolated.sms.maxWaitMs).toBeGreaterThan(60000); // the backlog stays in the SMS queue
  });

  it('fails loudly for a partner without a pool', () => {
    expect(() => simulate(jobs, { payment: 10 })).toThrow(/no pool/);
  });
});
