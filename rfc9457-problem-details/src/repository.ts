// src/repository.ts
import type { Bike, BikeRepository, Reservation } from './reservation.ts';

// An in-memory store is enough for the example. In real life: DynamoDB.
export class InMemoryBikeRepository implements BikeRepository {
  private bikes = new Map<string, Bike>([
    ['bike-1', { id: 'bike-1' }],
    ['bike-2', { id: 'bike-2', reservedUntil: '2030-01-01T00:00:00Z' }],
  ]);
  private reservations: Reservation[] = [];

  async findBike(bikeId: string) {
    return this.bikes.get(bikeId);
  }
  async countActiveReservations(customerId: string) {
    return this.reservations.filter((r) => r.customerId === customerId).length;
  }
  async saveReservation(reservation: Reservation) {
    this.reservations.push(reservation);
    this.bikes.set(reservation.bikeId, { id: reservation.bikeId, reservedUntil: reservation.to });
  }
}
