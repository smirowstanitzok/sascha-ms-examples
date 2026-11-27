// test/metrics.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calibrate, splitOf, type Pair } from '../src/metrics.ts';

test('perfect agreement gives kappa 1', () => {
  const pairs: Pair[] = [
    { human: 'pass', judge: 'pass' },
    { human: 'fail', judge: 'fail' },
  ];
  const r = calibrate(pairs);
  assert.equal(r.agreement, 1);
  assert.equal(r.kappa, 1);
});

test('kappa corrects high agreement for skewed distributions', () => {
  // 9 of 10 answers are good according to the human, the judge always says "pass"
  const pairs: Pair[] = [
    ...Array.from({ length: 9 }, () => ({ human: 'pass', judge: 'pass' }) as Pair),
    { human: 'fail', judge: 'pass' },
  ];
  const r = calibrate(pairs);
  assert.equal(r.agreement, 0.9);
  assert.equal(r.kappa, 0);
  assert.equal(r.falsePassRate, 1);
});

test('unknown is excluded from agreement but counted in its rate', () => {
  const pairs: Pair[] = [
    { human: 'pass', judge: 'pass' },
    { human: 'fail', judge: 'fail' },
    { human: 'fail', judge: 'unknown' },
    { human: 'pass', judge: 'unknown' },
  ];
  const r = calibrate(pairs);
  assert.equal(r.unknownRate, 0.5);
  assert.equal(r.agreement, 1);
});

test('kappa for a known example', () => {
  // human/judge: pp=20, pf=5, fp=10, ff=15 → po=0.7, pe=0.5, kappa=0.4
  const make = (h: 'pass' | 'fail', j: 'pass' | 'fail', n: number) =>
    Array.from({ length: n }, () => ({ human: h, judge: j }) as Pair);
  const r = calibrate([...make('pass', 'pass', 20), ...make('pass', 'fail', 5), ...make('fail', 'pass', 10), ...make('fail', 'fail', 15)]);
  assert.ok(Math.abs(r.kappa - 0.4) < 1e-9);
});

test('split is stable', () => {
  assert.equal(splitOf('r01'), splitOf('r01'));
});
