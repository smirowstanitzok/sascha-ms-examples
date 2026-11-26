// test/reservation.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInput, reserveBike, type BikeRepository } from '../src/reservation.ts';
import { toHttpError } from '../src/http.ts';

const repoWith = (overrides: Partial<BikeRepository> = {}): BikeRepository => ({
  findBike: async (id) => ({ id }),
  countActiveReservations: async () => 0,
  saveReservation: async () => {},
  ...overrides,
});

const input = { bikeId: 'bike-1', customerId: 'customer-7', from: '2027-05-01T09:00:00Z', to: '2027-05-01T18:00:00Z' };

test('reserves a free bike', async () => {
  const result = await reserveBike(input, repoWith());
  assert.equal(result.ok, true);
});

test('reports an unknown bike as BikeNotFound', async () => {
  const result = await reserveBike(input, repoWith({ findBike: async () => undefined }));
  assert.deepEqual(result, { ok: false, error: { kind: 'BikeNotFound', bikeId: 'bike-1' } });
});

test('reports the limit as 422', async () => {
  const result = await reserveBike(input, repoWith({ countActiveReservations: async () => 2 }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(toHttpError(result.error).statusCode, 422);
});

test('rejects an invalid date', () => {
  const result = parseInput({ ...input, to: 'tomorrow' });
  assert.equal(result.ok, false);
});

test('lets technical failures through as exceptions', async () => {
  const broken = repoWith({ saveReservation: async () => { throw new Error('Table unreachable'); } });
  await assert.rejects(reserveBike(input, broken), /Table unreachable/);
});
