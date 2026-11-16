// src/lib/events.ts
export const RENTAL_SOURCE = "radwerk.rentals";
export const RENTAL_ENDED = "RentalEnded";

export interface RentalEndedDetail {
  rentalId: string;
  bikeId: string;
  customerId: string;
  startedAt: string;
  endedAt: string;
}
