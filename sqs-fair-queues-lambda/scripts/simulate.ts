// scripts/simulate.ts
// Heavily simplified model – NOT the real SQS algorithm.
// It only shows the idea: oldest first vs. holding back noisy tenants.

export type Strategy = 'oldest-first' | 'fair';

interface Msg { club: string; sentAt: number; }

export interface Result { strategy: Strategy; quietP95: number; noisyP95: number; }

const STEP = 0.1;          // seconds per simulation step
const SLOTS = 100;         // messages that can be processed at once (concurrency x batch)
const WORK = 1.0;          // seconds of work per message
const DURATION = 120;      // simulated seconds

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)];
}

export function simulate(strategy: Strategy): Result {
  const backlog: Msg[] = [];
  const inFlight: { club: string; doneAt: number }[] = [];
  const dwell: Record<string, number[]> = {};

  // A large club imports 6,000 members at once
  for (let i = 0; i < 6000; i++) backlog.push({ club: 'tsv-gross', sentAt: 0 });

  for (let t = 0; t < DURATION; t += STEP) {
    // Four small clubs keep sending 5 jobs per second each
    for (const club of ['sv-a', 'sv-b', 'sv-c', 'sv-d']) {
      if (Math.round(t * 10) % 2 === 0) backlog.push({ club, sentAt: t });
    }

    // Remove finished messages
    for (let i = inFlight.length - 1; i >= 0; i--) {
      if (inFlight[i].doneAt <= t) inFlight.splice(i, 1);
    }

    // Fill free slots
    while (inFlight.length < SLOTS && backlog.length > 0) {
      let index = 0;
      if (strategy === 'fair') {
        const counts = new Map<string, number>();
        for (const m of inFlight) counts.set(m.club, (counts.get(m.club) ?? 0) + 1);
        const isNoisy = (club: string) => {
          const n = counts.get(club) ?? 0;
          return n >= 30 && n / Math.max(inFlight.length, 1) > 0.1;
        };
        const quiet = backlog.findIndex((m) => !isNoisy(m.club));
        index = quiet === -1 ? 0 : quiet;
      }
      const [msg] = backlog.splice(index, 1);
      (dwell[msg.club] ??= []).push(t - msg.sentAt);
      inFlight.push({ club: msg.club, doneAt: t + WORK });
    }
  }

  const quiet = Object.entries(dwell).filter(([c]) => c !== 'tsv-gross').flatMap(([, v]) => v);
  return { strategy, quietP95: p95(quiet), noisyP95: p95(dwell['tsv-gross'] ?? []) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const s of ['oldest-first', 'fair'] as const) {
    const r = simulate(s);
    console.log(`${r.strategy.padEnd(13)} quiet clubs p95: ${r.quietP95.toFixed(1)} s | noisy club p95: ${r.noisyP95.toFixed(1)} s`);
  }
}
