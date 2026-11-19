// src/pricing.ts
// Instead of "enum BikeType { ... }", an object with "as const":
// plain JavaScript plus types, so it runs via type stripping.
export const BikeType = {
  City: 'city',
  Ebike: 'ebike',
  Cargo: 'cargo',
} as const;

export type BikeType = (typeof BikeType)[keyof typeof BikeType];

export interface Rental {
  id: string;
  bike: BikeType;
  hours: number;
  member: boolean;
}

const HOURLY_RATE_CENT: Record<BikeType, number> = {
  city: 300,
  ebike: 600,
  cargo: 800,
};

const DAY_CAP_CENT: Record<BikeType, number> = {
  city: 1500,
  ebike: 3500,
  cargo: 4500,
};

export function priceInCent(rental: Rental): number {
  if (!Number.isFinite(rental.hours) || rental.hours <= 0) {
    throw new RangeError(`Invalid rental duration for ${rental.id}: ${rental.hours}`);
  }
  const fullDays = Math.floor(rental.hours / 24);
  const restHours = Math.ceil(rental.hours - fullDays * 24);
  const cap = DAY_CAP_CENT[rental.bike];
  const rest = Math.min(restHours * HOURLY_RATE_CENT[rental.bike], cap);
  const gross = fullDays * cap + rest;
  return rental.member ? Math.round(gross * 0.9) : gross;
}

export function formatEuro(cent: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cent / 100);
}
