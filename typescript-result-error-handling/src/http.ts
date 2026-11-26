// src/http.ts
import { assertNever } from './result.ts';
import type { ReservationError } from './errors.ts';

export type HttpResponse = { statusCode: number; headers: Record<string, string>; body: string };

const json = (statusCode: number, payload: unknown): HttpResponse => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});

export const created = (payload: unknown) => json(201, payload);

export function toHttpError(error: ReservationError): HttpResponse {
  switch (error.kind) {
    case 'InvalidInput':
      return json(400, { code: error.kind, message: error.message });
    case 'BikeNotFound':
      return json(404, { code: error.kind, message: `Bike ${error.bikeId} does not exist` });
    case 'BikeUnavailable':
      return json(409, { code: error.kind, message: `Bike is only free from ${error.freeFrom}` });
    case 'LimitReached':
      return json(422, { code: error.kind, message: `At most ${error.max} active reservations` });
    default:
      return assertNever(error);
  }
}
