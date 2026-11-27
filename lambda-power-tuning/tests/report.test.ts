// tests/report.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTable, pickSweetSpot, toRows, type TuningOutput } from '../src/report.ts';
import { buildCsv, handler } from '../src/handler.ts';

const sample: TuningOutput = {
  power: '512',
  cost: 0.0000021,
  duration: 250,
  stateMachine: { executionCost: 0.0003, lambdaCost: 0.002, visualization: 'https://lambda-power-tuning.show/#x' },
  stats: [
    { value: 1024, averagePrice: 0.0000022, averageDuration: 130 },
    { value: 128, averagePrice: 0.0000041, averageDuration: 1950 },
    { value: 512, averagePrice: 0.0000021, averageDuration: 250 },
    { value: 2048, averagePrice: 0.0000035, averageDuration: 105 },
  ],
};

test('toRows sorts by memory and scales to 1M invocations', () => {
  const rows = toRows(sample);
  assert.deepEqual(rows.map((r) => r.memoryMb), [128, 512, 1024, 2048]);
  assert.equal(rows[1].costPerMillionUsd, 2.1);
});

test('toRows without stats throws a clear error', () => {
  assert.throws(() => toRows({ ...sample, stats: undefined }), /includeOutputResults/);
});

test('pickSweetSpot picks 1024 MB: barely more expensive, much faster', () => {
  assert.equal(pickSweetSpot(toRows(sample)).memoryMb, 1024);
});

test('pickSweetSpot keeps the cheapest value if nothing is much faster', () => {
  const rows = toRows(sample);
  assert.equal(pickSweetSpot(rows, 0.01).memoryMb, 512);
});

test('formatTable contains the header and all rows', () => {
  const table = formatTable(toRows(sample));
  assert.match(table, /Memory \(MB\)/);
  assert.equal(table.split('\n').length, 6);
});

test('handler returns stable results', async () => {
  const a = await handler({ days: 3 });
  const b = await handler({ days: 3 });
  assert.equal(a.rows, 600);
  assert.equal(a.sha256, b.sha256);
  assert.ok(a.gzipBytes < a.rawBytes);
  assert.equal(buildCsv(1).split('\n').length, 201);
});
