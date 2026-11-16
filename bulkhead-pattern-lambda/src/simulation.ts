// src/simulation.ts
// Small, deterministic simulation: what happens to the waiting time of each
// partner when one partner hangs? Shared pool vs. one pool per partner.

export interface Job {
  partner: string;
  arrivalMs: number;
  durationMs: number;
}

export interface PartnerStats {
  jobs: number;
  maxWaitMs: number;
  avgWaitMs: number;
}

/** A number means one shared pool, an object means one pool per partner. */
export type Pools = number | Record<string, number>;

export function simulate(jobs: Job[], pools: Pools): Record<string, PartnerStats> {
  const slots = new Map<string, number[]>(); // pool name -> times when slots become free
  const poolOf = (partner: string) => (typeof pools === 'number' ? 'shared' : partner);
  const sizeOf = (partner: string) => {
    const size = typeof pools === 'number' ? pools : pools[partner];
    if (!size) throw new Error(`no pool for partner ${partner}`);
    return size;
  };

  const waits = new Map<string, number[]>();
  const sorted = [...jobs].sort((a, b) => a.arrivalMs - b.arrivalMs);

  for (const job of sorted) {
    const pool = poolOf(job.partner);
    if (!slots.has(pool)) slots.set(pool, new Array(sizeOf(job.partner)).fill(0));
    const free = slots.get(pool)!;

    // First in, first out: take the slot that becomes free first.
    let idx = 0;
    for (let i = 1; i < free.length; i++) if (free[i] < free[idx]) idx = i;

    const start = Math.max(job.arrivalMs, free[idx]);
    free[idx] = start + job.durationMs;

    const list = waits.get(job.partner) ?? [];
    list.push(start - job.arrivalMs);
    waits.set(job.partner, list);
  }

  const result: Record<string, PartnerStats> = {};
  for (const [partner, list] of waits) {
    result[partner] = {
      jobs: list.length,
      maxWaitMs: Math.max(...list),
      avgWaitMs: Math.round(list.reduce((s, w) => s + w, 0) / list.length),
    };
  }
  return result;
}

/** One booking every 100 ms, each booking creates three partner jobs. */
export function bookingWave(bookings: number, durations: Record<string, number>): Job[] {
  const jobs: Job[] = [];
  for (let i = 0; i < bookings; i++) {
    for (const [partner, durationMs] of Object.entries(durations)) {
      jobs.push({ partner, arrivalMs: i * 100, durationMs });
    }
  }
  return jobs;
}
