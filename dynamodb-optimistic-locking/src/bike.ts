// src/bike.ts
export type BikeStatus = 'AVAILABLE' | 'RENTED' | 'MAINTENANCE';

export interface Bike {
  bikeId: string;
  station: string;
  status: BikeStatus;
  ridesSinceService: number;
  rentedBy?: string;
  rentedAt?: string;
  note?: string;
  version: number;
}

/** After this many rides a bike has to go to the workshop. */
export const RIDES_UNTIL_SERVICE = 30;

export type RejectReason = 'NOT_AVAILABLE' | 'SERVICE_DUE' | 'NOT_RENTED' | 'WRONG_CUSTOMER';

export class RentalRejectedError extends Error {
  constructor(public readonly reason: RejectReason) {
    super(`Rental rejected: ${reason}`);
    this.name = 'RentalRejectedError';
  }
}

/** Pure business logic: decides based on the state that was read. */
export function rentBike(bike: Bike, customerId: string, now: Date): Bike {
  if (bike.status !== 'AVAILABLE') throw new RentalRejectedError('NOT_AVAILABLE');
  if (bike.ridesSinceService >= RIDES_UNTIL_SERVICE) throw new RentalRejectedError('SERVICE_DUE');
  return {
    ...bike,
    status: 'RENTED',
    rentedBy: customerId,
    rentedAt: now.toISOString(),
    ridesSinceService: bike.ridesSinceService + 1,
  };
}

export function returnBike(bike: Bike, customerId: string, station: string): Bike {
  if (bike.status !== 'RENTED') throw new RentalRejectedError('NOT_RENTED');
  if (bike.rentedBy !== customerId) throw new RentalRejectedError('WRONG_CUSTOMER');
  const { rentedBy: _rentedBy, rentedAt: _rentedAt, ...rest } = bike;
  return {
    ...rest,
    station,
    status: bike.ridesSinceService >= RIDES_UNTIL_SERVICE ? 'MAINTENANCE' : 'AVAILABLE',
  };
}
