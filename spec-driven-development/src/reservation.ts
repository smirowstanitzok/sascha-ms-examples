// src/reservation.ts
// Implements specs/001-reservation-with-expiry/spec.md (FR-001 to FR-004)

export const HOLD_MINUTES = 15;
export const MAX_OPEN_RESERVATIONS = 2;

export type ReservationStatus = "RESERVED" | "PICKED_UP" | "EXPIRED";

export interface Reservation {
  reservationId: string;
  customerId: string;
  bikeId: string;
  status: ReservationStatus;
  createdAt: string; // ISO-8601
  expiresAt: string; // ISO-8601
}

export class SpecViolation extends Error {
  constructor(public readonly rule: string, message: string) {
    super(message);
    this.name = "SpecViolation";
  }
}

// FR-001: A reservation holds a bike for exactly 15 minutes.
export function createReservation(
  input: { reservationId: string; customerId: string; bikeId: string },
  openReservationsOfCustomer: number,
  now: Date,
): Reservation {
  // FR-003: At most two open reservations per customer.
  if (openReservationsOfCustomer >= MAX_OPEN_RESERVATIONS) {
    throw new SpecViolation(
      "FR-003",
      `There are already ${MAX_OPEN_RESERVATIONS} open reservations.`,
    );
  }
  const expiresAt = new Date(now.getTime() + HOLD_MINUTES * 60_000);
  return {
    ...input,
    status: "RESERVED",
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

// FR-002: After expiry the reservation counts as expired, even if nothing has cleaned it up yet.
export function effectiveStatus(r: Reservation, now: Date): ReservationStatus {
  if (r.status === "RESERVED" && now.getTime() >= Date.parse(r.expiresAt)) {
    return "EXPIRED";
  }
  return r.status;
}

// FR-004: Pick-up is only possible while the reservation is valid.
export function pickUp(r: Reservation, now: Date): Reservation {
  const status = effectiveStatus(r, now);
  if (status !== "RESERVED") {
    throw new SpecViolation("FR-004", `Pick-up not possible, status is ${status}.`);
  }
  return { ...r, status: "PICKED_UP" };
}
