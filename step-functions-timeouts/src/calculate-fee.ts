// src/calculate-fee.ts
export interface ReturnInput {
  rentalId: string;
  bikeId: string;
  minutes: number;
}

export interface Fee {
  amountCents: number;
  currency: 'EUR';
}

const UNLOCK_CENTS = 100;
const PER_MINUTE_CENTS = 25;

export const handler = async (input: ReturnInput): Promise<Fee> => {
  if (!Number.isInteger(input.minutes) || input.minutes < 0) {
    throw new Error(`Invalid rental duration: ${input.minutes}`);
  }
  return { amountCents: UNLOCK_CENTS + input.minutes * PER_MINUTE_CENTS, currency: 'EUR' };
};
