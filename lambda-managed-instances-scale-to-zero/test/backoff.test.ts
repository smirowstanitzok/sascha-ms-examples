// test/backoff.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backoffDelays, withBackoff, isThrottle } from '../src/backoff';
import { buildReport } from '../src/handler';

const throttle = () => Object.assign(new Error('Rate exceeded'), { name: 'TooManyRequestsException' });

test('delays stay within the total budget', () => {
  const delays = backoffDelays({ baseMs: 1000, capMs: 30000, maxTotalMs: 480000, random: () => 1 });
  assert.deepEqual(delays.slice(0, 6), [1000, 2000, 4000, 8000, 16000, 30000]);
  assert.ok(delays.reduce((a, b) => a + b, 0) <= 480000);
});

test('detects throttling by name or status code', () => {
  assert.equal(isThrottle(throttle()), true);
  assert.equal(isThrottle({ $metadata: { httpStatusCode: 429 } }), true);
  assert.equal(isThrottle(new Error('broken')), false);
});

test('retries after 429 and then returns the result', async () => {
  let calls = 0;
  const result = await withBackoff(
    async () => { calls++; if (calls < 3) throw throttle(); return 'done'; },
    { baseMs: 1, capMs: 2, maxTotalMs: 100 }, () => {}, async () => {},
  );
  assert.equal(result, 'done');
  assert.equal(calls, 3);
});

test('passes other errors on immediately', async () => {
  let calls = 0;
  await assert.rejects(
    withBackoff(async () => { calls++; throw new Error('Validation'); },
      { baseMs: 1, capMs: 2, maxTotalMs: 100 }, () => {}, async () => {}),
    /Validation/,
  );
  assert.equal(calls, 1);
});

test('report lists bikes past the service interval', () => {
  const report = buildReport({
    stationId: 'harbor-east',
    rentals: [
      { bikeId: 'bike-07', kilometers: 320 },
      { bikeId: 'bike-07', kilometers: 240 },
      { bikeId: 'bike-12', kilometers: 90 },
    ],
  }, new Date('2026-11-18T06:00:00Z'));
  assert.equal(report.bikesChecked, 2);
  assert.deepEqual(report.bikesDue, [{ bikeId: 'bike-07', totalKm: 560 }]);
});
