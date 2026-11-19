// test/pricing.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BikeType, priceInCent } from '../src/pricing.ts';

test('city bike: 2 hours cost 6 euros', () => {
  assert.equal(priceInCent({ id: 'r1', bike: BikeType.City, hours: 2, member: false }), 600);
});

test('e-bike: the daily cap applies from the 6th hour', () => {
  assert.equal(priceInCent({ id: 'r2', bike: BikeType.Ebike, hours: 7, member: false }), 3500);
});

test('members get a 10 percent discount', () => {
  assert.equal(priceInCent({ id: 'r3', bike: BikeType.Cargo, hours: 1, member: true }), 720);
});

test('started hours are rounded up', () => {
  assert.equal(priceInCent({ id: 'r4', bike: BikeType.City, hours: 1.25, member: false }), 600);
});

test('an invalid duration throws a RangeError', () => {
  assert.throws(
    () => priceInCent({ id: 'r5', bike: BikeType.City, hours: 0, member: false }),
    /Invalid rental duration/,
  );
});
