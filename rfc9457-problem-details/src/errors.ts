// src/errors.ts
// An input issue points to the affected field via JSON Pointer
export type FieldIssue = { pointer: string; detail: string };

export type ReservationError =
  | { kind: 'InvalidInput'; issues: FieldIssue[] }
  | { kind: 'BikeNotFound'; bikeId: string }
  | { kind: 'BikeUnavailable'; bikeId: string; freeFrom: string }
  | { kind: 'LimitReached'; customerId: string; max: number };
