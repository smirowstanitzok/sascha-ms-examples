// src/pricing.ts
export type BoatType = 'kayak' | 'canoe' | 'sup';

const HOURLY_RATE_CENTS: Record<BoatType, number> = {
  kayak: 500,
  canoe: 700,
  sup: 400,
};

// Daily cap: nobody pays more than 6 hours per started day.
const MAX_BILLED_HOURS_PER_DAY = 6;

export function isBoatType(value: string): value is BoatType {
  return value in HOURLY_RATE_CENTS;
}

export function calculateRentalPrice(boat: BoatType, hours: number): number {
  if (!Number.isInteger(hours) || hours < 1 || hours > 72) {
    throw new RangeError('hours must be an integer between 1 and 72');
  }
  const fullDays = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  const billedHours =
    fullDays * MAX_BILLED_HOURS_PER_DAY + Math.min(remainingHours, MAX_BILLED_HOURS_PER_DAY);
  return billedHours * HOURLY_RATE_CENTS[boat];
}
