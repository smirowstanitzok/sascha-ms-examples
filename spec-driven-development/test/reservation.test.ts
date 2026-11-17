// test/reservation.test.ts
// Each test maps to one acceptance scenario from spec.md
import { describe, expect, it } from "vitest";
import {
  createReservation,
  effectiveStatus,
  pickUp,
  SpecViolation,
} from "../src/reservation";

const now = new Date("2026-11-17T10:00:00.000Z");
const input = { reservationId: "r-1", customerId: "c-7", bikeId: "bike-42" };
const minutes = (m: number) => new Date(now.getTime() + m * 60_000);

describe("Reservation with expiry (specs/001)", () => {
  it("AS-1: a new reservation expires after 15 minutes", () => {
    const r = createReservation(input, 0, now);
    expect(r.status).toBe("RESERVED");
    expect(r.expiresAt).toBe("2026-11-17T10:15:00.000Z");
  });

  it("AS-2: after expiry the reservation counts as expired", () => {
    const r = createReservation(input, 0, now);
    expect(effectiveStatus(r, minutes(14))).toBe("RESERVED");
    expect(effectiveStatus(r, minutes(15))).toBe("EXPIRED");
  });

  it("AS-3: a third open reservation is rejected", () => {
    expect(() => createReservation(input, 2, now)).toThrow(SpecViolation);
    expect(() => createReservation(input, 2, now)).toThrow(/already 2 open reservations/);
  });

  it("AS-4: pick-up only works within the hold time", () => {
    const r = createReservation(input, 1, now);
    expect(pickUp(r, minutes(10)).status).toBe("PICKED_UP");
    expect(() => pickUp(r, minutes(16))).toThrow(/status is EXPIRED/);
  });
});
