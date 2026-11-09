// test/bike.test.ts
import { describe, expect, it } from 'vitest';
import { RIDES_UNTIL_SERVICE, RentalRejectedError, rentBike, returnBike, type Bike } from '../src/bike.js';

const bike: Bike = { bikeId: 'b-17', station: 'harbour', status: 'AVAILABLE', ridesSinceService: 3, version: 4 };
const now = new Date('2026-11-09T10:00:00Z');

describe('rentBike', () => {
  it('rents an available bike and keeps the version that was read', () => {
    const next = rentBike(bike, 'c-1', now);
    expect(next).toMatchObject({ status: 'RENTED', rentedBy: 'c-1', ridesSinceService: 4, version: 4 });
  });

  it('rejects a bike that is already rented', () => {
    const rented = rentBike(bike, 'c-1', now);
    expect(() => rentBike(rented, 'c-2', now)).toThrow(RentalRejectedError);
  });

  it('rejects a bike that is due for service', () => {
    expect(() => rentBike({ ...bike, ridesSinceService: RIDES_UNTIL_SERVICE }, 'c-1', now)).toThrow(/SERVICE_DUE/);
  });
});

describe('returnBike', () => {
  it('sends the bike to the workshop after the last ride before service', () => {
    const rented = rentBike({ ...bike, ridesSinceService: RIDES_UNTIL_SERVICE - 1 }, 'c-1', now);
    const returned = returnBike(rented, 'c-1', 'station-west');
    expect(returned).toMatchObject({ status: 'MAINTENANCE', station: 'station-west' });
    expect(returned.rentedBy).toBeUndefined();
  });

  it('only lets the renting customer return the bike', () => {
    const rented = rentBike(bike, 'c-1', now);
    expect(() => returnBike(rented, 'c-2', 'harbour')).toThrow(/WRONG_CUSTOMER/);
  });
});
