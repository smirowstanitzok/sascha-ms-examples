// scripts/simulate.ts
import { bookingWave, simulate } from '../src/simulation.ts';

// 200 bookings, the SMS gateway hangs: every call runs into the 2.5 s timeout.
const jobs = bookingWave(200, { payment: 400, lock: 300, sms: 2500 });

const shared = simulate(jobs, 20);
const bulkheads = simulate(jobs, { payment: 10, lock: 6, sms: 4 });

const row = (name: string, s: Record<string, { maxWaitMs: number; avgWaitMs: number }>) =>
  console.log(
    name.padEnd(12),
    Object.entries(s)
      .map(([p, v]) => `${p}: avg ${v.avgWaitMs} ms, max ${v.maxWaitMs} ms`)
      .join(' | '),
  );

row('shared pool', shared);
row('bulkheads', bulkheads);
