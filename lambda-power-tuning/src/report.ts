// src/report.ts
export interface PowerStat {
  value: number;
  averagePrice: number;
  averageDuration: number;
}

export interface TuningOutput {
  power: string | number;
  cost: number;
  duration: number;
  stateMachine: { executionCost: number; lambdaCost: number; visualization: string };
  stats?: PowerStat[];
}

export interface ReportRow {
  memoryMb: number;
  durationMs: number;
  costPerMillionUsd: number;
}

// Turns the state machine output into table rows (cost per 1M invocations).
export function toRows(output: TuningOutput): ReportRow[] {
  if (!output.stats?.length) {
    throw new Error('No stats in the output – set includeOutputResults to true.');
  }
  return [...output.stats]
    .sort((a, b) => a.value - b.value)
    .map((s) => ({
      memoryMb: s.value,
      durationMs: Math.round(s.averageDuration * 10) / 10,
      costPerMillionUsd: Math.round(s.averagePrice * 1_000_000 * 100) / 100,
    }));
}

// Fastest memory size that costs at most `maxExtraCost` (e.g. 0.1 = 10%) more than
// the cheapest option while being at least `minSpeedup` faster than it.
export function pickSweetSpot(rows: ReportRow[], maxExtraCost = 0.1, minSpeedup = 0.2): ReportRow {
  if (rows.length === 0) throw new Error('No measurements available.');
  const cheapest = rows.reduce((a, b) => (b.costPerMillionUsd < a.costPerMillionUsd ? b : a));
  const candidates = rows.filter(
    (r) =>
      r.costPerMillionUsd <= cheapest.costPerMillionUsd * (1 + maxExtraCost) &&
      r.durationMs <= cheapest.durationMs * (1 - minSpeedup),
  );
  if (candidates.length === 0) return cheapest;
  return candidates.reduce((a, b) => (b.durationMs < a.durationMs ? b : a));
}

export function formatTable(rows: ReportRow[]): string {
  const header = 'Memory (MB) | Duration (ms) | Cost per 1M invocations (USD)';
  const lines = rows.map(
    (r) => `${String(r.memoryMb).padStart(11)} | ${String(r.durationMs).padStart(13)} | ${r.costPerMillionUsd.toFixed(2).padStart(30)}`,
  );
  return [header, '-'.repeat(header.length), ...lines].join('\n');
}
