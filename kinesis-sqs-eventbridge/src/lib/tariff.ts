// src/lib/tariff.ts
// Fictional tariff: EUR 1.00 base fee plus EUR 0.20 per started minute, daily cap EUR 15
const BASE_CENTS = 100;
const PER_MINUTE_CENTS = 20;
const DAILY_CAP_CENTS = 1500;

export function priceInCents(startedAt: string, endedAt: string): number {
  const ms = Date.parse(endedAt) - Date.parse(startedAt);
  if (Number.isNaN(ms) || ms < 0) {
    throw new Error("End is before start or date is invalid");
  }
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return Math.min(BASE_CENTS + minutes * PER_MINUTE_CENTS, DAILY_CAP_CENTS);
}
