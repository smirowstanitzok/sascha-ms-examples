// src/sle.ts
export interface Ticket {
  id: string;
  start: string; // ISO date, e.g. 2026-10-05
  end?: string; // empty = still in progress
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Calendar days including start and end day: finished on the same day = 1 day
export function elapsedDays(start: string, end: string): number {
  const diff = Date.parse(end) - Date.parse(start);
  if (Number.isNaN(diff) || diff < 0) {
    throw new Error(`Invalid period: ${start} to ${end}`);
  }
  return Math.floor(diff / MS_PER_DAY) + 1;
}

// Nearest-rank method: smallest value with at least p% of the data <= value
export function percentile(values: number[], p: number): number {
  if (values.length === 0) throw new Error("No data for the percentile");
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.max(rank, 1) - 1];
}

export function parseCsv(text: string): Ticket[] {
  return text
    .trim()
    .split(/\r?\n/)
    .slice(1) // header row: id,start,end
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [id, start, end] = line.split(",").map((s) => s.trim());
      return { id, start, end: end || undefined };
    });
}

export interface SleReport {
  finished: number;
  cycleTimes: number[];
  p50: number;
  p70: number;
  p85: number;
  p95: number;
}

export function buildReport(tickets: Ticket[], since?: string): SleReport {
  const done = tickets.filter(
    (t) => t.end !== undefined && (!since || t.end >= since),
  );
  const cycleTimes = done.map((t) => elapsedDays(t.start, t.end as string));
  return {
    finished: done.length,
    cycleTimes,
    p50: percentile(cycleTimes, 50),
    p70: percentile(cycleTimes, 70),
    p85: percentile(cycleTimes, 85),
    p95: percentile(cycleTimes, 95),
  };
}

export type AgeStatus = "on track" | "watch" | "critical" | "over SLE";

// Traffic light for the daily: where does an open ticket stand compared to history?
export function ageStatus(age: number, r: SleReport): AgeStatus {
  if (age > r.p85) return "over SLE";
  if (age > r.p70) return "critical";
  if (age > r.p50) return "watch";
  return "on track";
}

export function openItems(tickets: Ticket[], today: string, r: SleReport) {
  return tickets
    .filter((t) => t.end === undefined)
    .map((t) => {
      const age = elapsedDays(t.start, today);
      return { id: t.id, age, status: ageStatus(age, r) };
    })
    .sort((a, b) => b.age - a.age);
}
