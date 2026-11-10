// src/monte-carlo.ts
// Monte Carlo forecast from throughput data: no dependencies, just Node.js.

/** Deterministic random generator (mulberry32) so tests are reproducible. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isWorkday = (d: Date): boolean => d.getUTCDay() !== 0 && d.getUTCDay() !== 6;
const toDay = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Turns a list of finish dates (YYYY-MM-DD) into throughput per workday.
 * Important: days without a finished ticket count as 0 and must be included.
 */
export function dailyThroughput(finishedDates: string[], from: string, to: string): number[] {
  const counts = new Map<string, number>();
  for (const date of finishedDates) counts.set(date, (counts.get(date) ?? 0) + 1);

  const samples: number[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); toDay(d) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    if (isWorkday(d)) samples.push(counts.get(toDay(d)) ?? 0);
  }
  if (samples.length === 0) throw new Error('No workdays in the selected period');
  if (samples.every((s) => s === 0)) throw new Error('Nothing was finished in this period – no forecast possible');
  return samples;
}

/** Value that p percent of the sorted results do not exceed (nearest-rank method). */
export function percentile(sorted: number[], p: number): number {
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

export interface ForecastOptions {
  trials?: number;
  seed?: number;
}

/** Question 1: “When will N tickets be done?” – returns the workdays needed per run (sorted). */
export function simulateWhen(samples: number[], remainingItems: number, opts: ForecastOptions = {}): number[] {
  const { trials = 10_000, seed = 42 } = opts;
  if (remainingItems <= 0) throw new Error('remainingItems must be greater than 0');
  const random = createRandom(seed);
  const results: number[] = [];

  for (let i = 0; i < trials; i++) {
    let done = 0;
    let days = 0;
    while (done < remainingItems) {
      done += samples[Math.floor(random() * samples.length)];
      days++;
    }
    results.push(days);
  }
  return results.sort((a, b) => a - b);
}

/** Question 2: “How many tickets can we finish in X workdays?” – returns the count per run (sorted). */
export function simulateHowMany(samples: number[], workdays: number, opts: ForecastOptions = {}): number[] {
  const { trials = 10_000, seed = 42 } = opts;
  const random = createRandom(seed);
  const results: number[] = [];

  for (let i = 0; i < trials; i++) {
    let done = 0;
    for (let day = 0; day < workdays; day++) {
      done += samples[Math.floor(random() * samples.length)];
    }
    results.push(done);
  }
  return results.sort((a, b) => a - b);
}

/** Date of the n-th workday from start (if the start is a workday, it is day 1). */
export function addWorkdays(start: string, workdays: number): string {
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  let left = workdays;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isWorkday(d)) left--;
  }
  return toDay(d);
}
