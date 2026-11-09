// src/config.ts
import { getParametersByName } from '@aws-lambda-powertools/parameters/ssm';
import type { SSMGetParametersByNameOptions } from '@aws-lambda-powertools/parameters/ssm/types';

export interface RentalConfig {
  pricePerHourCents: number;
  rentalPaused: boolean;
  paymentApiKey: string;
}

const prefix = process.env.PARAM_PREFIX ?? '/bike-rental/dev';

// Turns the raw strings from Parameter Store into a checked config object
export function parseConfig(raw: Record<string, unknown>, base: string): RentalConfig {
  const price = Number(raw[`${base}/price-per-hour-cents`]);
  if (!Number.isInteger(price) || price <= 0) {
    throw new Error('price-per-hour-cents must be a positive integer');
  }
  const paused = String(raw[`${base}/rental-paused`]).trim().toLowerCase();
  if (paused !== 'true' && paused !== 'false') {
    throw new Error('rental-paused must be "true" or "false"');
  }
  const key = raw[`${base}/payment-api-key`];
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('payment-api-key is missing');
  }
  return { pricePerHourCents: price, rentalPaused: paused === 'true', paymentApiKey: key };
}

export async function loadConfig(): Promise<RentalConfig> {
  const props: Record<string, SSMGetParametersByNameOptions> = {
    [`${prefix}/price-per-hour-cents`]: {},
    // Switch that should take effect quickly: shorter cache
    [`${prefix}/rental-paused`]: { maxAge: 30 },
    // SecureString: decrypted with KMS
    [`${prefix}/payment-api-key`]: { decrypt: true },
  };
  // Without per-parameter maxAge the value comes from POWERTOOLS_PARAMETERS_MAX_AGE
  const raw = await getParametersByName(props);
  return parseConfig(raw as Record<string, unknown>, prefix);
}
