// src/pricing.ts
import type { RentalConfig } from './config.js';

export const MAX_HOURS = 72;

export type Quote =
  | { ok: true; hours: number; totalCents: number }
  | { ok: false; reason: string };

// Every started hour counts, at least one hour, at most MAX_HOURS
export function quotePrice(hours: number, config: Pick<RentalConfig, 'pricePerHourCents' | 'rentalPaused'>): Quote {
  if (config.rentalPaused) {
    return { ok: false, reason: 'Rentals are paused at the moment' };
  }
  if (!Number.isFinite(hours) || hours <= 0) {
    return { ok: false, reason: 'hours must be greater than 0' };
  }
  const billed = Math.max(1, Math.ceil(hours));
  if (billed > MAX_HOURS) {
    return { ok: false, reason: `at most ${MAX_HOURS} hours` };
  }
  return { ok: true, hours: billed, totalCents: billed * config.pricePerHourCents };
}
