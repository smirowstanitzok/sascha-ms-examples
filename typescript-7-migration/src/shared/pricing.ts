// src/shared/pricing.ts
export function rentalPriceCents(hours: number, pricePerHourCents = 450): number {
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error('The rental duration must be positive');
  }
  return Math.round(hours * pricePerHourCents);
}
