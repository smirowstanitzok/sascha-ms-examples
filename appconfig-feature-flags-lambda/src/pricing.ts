// src/pricing.ts
// Pure pricing logic without AWS dependencies, so it is easy to test.
import type { TicketFlags } from "./flags";

export type SeatType = "standard" | "premium";

const PRICE_CENT: Record<SeatType, number> = { standard: 1100, premium: 1450 };

export function quotePrice(seat: SeatType, tickets: number, showtime: Date, flags: TicketFlags): number {
  const base = PRICE_CENT[seat] * tickets;
  const isSunday = showtime.getUTCDay() === 0;
  if (flags.sundayDiscount.enabled && isSunday) {
    return Math.round(base * (1 - flags.sundayDiscount.discountPercent / 100));
  }
  return base;
}
