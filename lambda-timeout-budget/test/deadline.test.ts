// test/deadline.test.ts
import { describe, expect, it } from 'vitest';
import { Deadline, DeadlineExceededError } from '../src/deadline';
import { getMaintenanceStatus } from '../src/partner-client';

const fakeClock = (start = 0) => {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
};

describe('Deadline', () => {
  it('subtracts the reserve and respects the upper limit', () => {
    const clock = fakeClock();
    const d = Deadline.fromLambdaContext({ getRemainingTimeInMillis: () => 10_000 }, { reserveMs: 500, capMs: 8000, now: clock.now });
    expect(d.remainingMs()).toBe(8000);
  });

  it('never gives a step more than what is left', () => {
    const clock = fakeClock();
    const d = new Deadline(1000, clock.now);
    clock.advance(700);
    expect(d.budgetFor('partner', 1500)).toBe(300);
  });

  it('throws when the budget is exhausted', () => {
    const clock = fakeClock();
    const d = new Deadline(1000, clock.now);
    clock.advance(980);
    expect(() => d.budgetFor('partner', 1500)).toThrow(DeadlineExceededError);
  });
});

describe('getMaintenanceStatus', () => {
  it('aborts a hanging partner call after the budget', async () => {
    const hangingFetch = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      })) as typeof fetch;

    const started = Date.now();
    await expect(
      getMaintenanceStatus('bike-42', new Deadline(400), { baseUrl: 'https://maintenance.test', perAttemptMs: 150, fetchFn: hangingFetch }),
    ).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(600);
  });

  it('returns the status when the partner answers in time', async () => {
    const okFetch = (async () => new Response(JSON.stringify({ state: 'in_repair' }), { status: 200 })) as typeof fetch;
    const status = await getMaintenanceStatus('bike-7', new Deadline(2000), { baseUrl: 'https://maintenance.test', fetchFn: okFetch });
    expect(status.state).toBe('in_repair');
  });
});
