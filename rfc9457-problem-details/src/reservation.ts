// src/reservation.ts
import { err, ok, type Result } from './result.ts';
import type { FieldIssue, ReservationError } from './errors.ts';

export type Bike = { id: string; reservedUntil?: string };
export type Reservation = { bikeId: string; customerId: string; from: string; to: string };

export interface BikeRepository {
  findBike(bikeId: string): Promise<Bike | undefined>;
  countActiveReservations(customerId: string): Promise<number>;
  saveReservation(reservation: Reservation): Promise<void>;
}

const MAX_ACTIVE_RESERVATIONS = 2;

const isDate = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

// Collects all input issues at once instead of stopping at the first one
export function parseInput(body: unknown): Result<Reservation, ReservationError> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return err({ kind: 'InvalidInput', issues: [{ pointer: '#', detail: 'Body must be a JSON object' }] });
  }
  const { bikeId, customerId, from, to } = body as Record<string, unknown>;
  const issues: FieldIssue[] = [];
  if (typeof bikeId !== 'string' || bikeId === '') issues.push({ pointer: '#/bikeId', detail: 'required' });
  if (typeof customerId !== 'string' || customerId === '') issues.push({ pointer: '#/customerId', detail: 'required' });
  if (!isDate(from)) issues.push({ pointer: '#/from', detail: 'must be an ISO date' });
  if (!isDate(to)) issues.push({ pointer: '#/to', detail: 'must be an ISO date' });
  if (isDate(from) && isDate(to) && Date.parse(from) >= Date.parse(to)) {
    issues.push({ pointer: '#/to', detail: 'must be after from' });
  }
  if (issues.length > 0) return err({ kind: 'InvalidInput', issues });
  return ok({ bikeId: bikeId as string, customerId: customerId as string, from: from as string, to: to as string });
}

export async function reserveBike(
  input: Reservation,
  repo: BikeRepository,
): Promise<Result<Reservation, ReservationError>> {
  const bike = await repo.findBike(input.bikeId);
  if (!bike) return err({ kind: 'BikeNotFound', bikeId: input.bikeId });
  if (bike.reservedUntil && Date.parse(bike.reservedUntil) > Date.parse(input.from)) {
    return err({ kind: 'BikeUnavailable', bikeId: bike.id, freeFrom: bike.reservedUntil });
  }
  const active = await repo.countActiveReservations(input.customerId);
  if (active >= MAX_ACTIVE_RESERVATIONS) {
    return err({ kind: 'LimitReached', customerId: input.customerId, max: MAX_ACTIVE_RESERVATIONS });
  }
  await repo.saveReservation(input); // Failure? Then an exception is thrown here
  return ok(input);
}
