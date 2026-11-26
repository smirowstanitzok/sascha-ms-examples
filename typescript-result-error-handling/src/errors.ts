// src/errors.ts
export type ReservationError =
  | { kind: 'InvalidInput'; message: string }
  | { kind: 'BikeNotFound'; bikeId: string }
  | { kind: 'BikeUnavailable'; bikeId: string; freeFrom: string }
  | { kind: 'LimitReached'; customerId: string; max: number };
