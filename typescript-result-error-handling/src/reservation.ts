// src/reservation.ts
import { err, ok, type Result } from './result.ts';
import type { ReservationError } from './errors.ts';

export type Bike = { id: string; reservedUntil?: string };
export type Reservation = { bikeId: string; customerId: string; from: string; to: string };

// Everything that talks to the outside world comes in through this interface
export interface BikeRepository {
  findBike(bikeId: string): Promise<Bike | undefined>;
  countActiveReservations(customerId: string): Promise<number>;
  saveReservation(reservation: Reservation): Promise<void>;
}

export type ReserveInput = { bikeId: string; customerId: string; from: string; to: string };

const MAX_ACTIVE_RESERVATIONS = 2;

export function parseInput(body: unknown): Result<ReserveInput, ReservationError> {
  if (typeof body !== 'object' || body === null) {
    return err({ kind: 'InvalidInput', message: 'Body must be a JSON object' });
  }
  const { bikeId, customerId, from, to } = body as Record<string, unknown>;
  if (typeof bikeId !== 'string' || typeof customerId !== 'string') {
    return err({ kind: 'InvalidInput', message: 'bikeId and customerId are required' });
  }
  if (typeof from !== 'string' || typeof to !== 'string' || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    return err({ kind: 'InvalidInput', message: 'from and to must be ISO dates' });
  }
  if (Date.parse(from) >= Date.parse(to)) {
    return err({ kind: 'InvalidInput', message: 'from must be before to' });
  }
  return ok({ bikeId, customerId, from, to });
}

export async function reserveBike(
  input: ReserveInput,
  repo: BikeRepository,
): Promise<Result<Reservation, ReservationError>> {
  const bike = await repo.findBike(input.bikeId);
  if (!bike) {
    return err({ kind: 'BikeNotFound', bikeId: input.bikeId });
  }
  if (bike.reservedUntil && Date.parse(bike.reservedUntil) > Date.parse(input.from)) {
    return err({ kind: 'BikeUnavailable', bikeId: bike.id, freeFrom: bike.reservedUntil });
  }
  const active = await repo.countActiveReservations(input.customerId);
  if (active >= MAX_ACTIVE_RESERVATIONS) {
    return err({ kind: 'LimitReached', customerId: input.customerId, max: MAX_ACTIVE_RESERVATIONS });
  }
  const reservation: Reservation = { ...input };
  await repo.saveReservation(reservation); // technical failure? Then an exception is thrown here on purpose
  return ok(reservation);
}
