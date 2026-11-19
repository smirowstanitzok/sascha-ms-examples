// src/handler.ts
import { BikeType, formatEuro, priceInCent, type Rental } from './pricing.ts';

interface HttpEvent {
  body?: string | null;
}

interface HttpResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const bikeTypes = new Set<string>(Object.values(BikeType));

function isRental(value: unknown): value is Rental {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.bike === 'string' &&
    bikeTypes.has(v.bike) &&
    typeof v.hours === 'number' &&
    typeof v.member === 'boolean'
  );
}

function json(statusCode: number, payload: unknown): HttpResult {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

export async function quote(event: HttpEvent): Promise<HttpResult> {
  let input: unknown;
  try {
    input = JSON.parse(event.body ?? '');
  } catch {
    return json(400, { message: 'Body is not valid JSON' });
  }
  if (!isRental(input)) {
    return json(422, { message: 'Expected: id, bike, hours, member' });
  }
  try {
    const cent = priceInCent(input);
    return json(200, { id: input.id, cent, label: formatEuro(cent) });
  } catch (err) {
    return json(422, { message: (err as Error).message });
  }
}
