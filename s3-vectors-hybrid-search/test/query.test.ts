// test/query.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuery } from '../src/query.ts';
import { reciprocalRankFusion } from '../src/rrf.ts';

const base = { bucket: 'b', index: 'i' };

test('a vector produces a hybrid request', () => {
  const input = buildQuery({ ...base, text: 'error code E-417', vector: [0.1, 0.2] });
  assert.deepEqual(input.queryVector, { float32: [0.1, 0.2] });
  assert.equal(input.queryTexts?.length, 2);
  assert.equal(input.returnScores, true);
});

test('without a vector it stays full-text only', () => {
  const input = buildQuery({ ...base, text: 'E-417' });
  assert.equal(input.queryVector, undefined);
});

test('category becomes a filter, topK is capped', () => {
  const input = buildQuery({ ...base, text: 'battery', category: 'e-bike', topK: 500 });
  assert.deepEqual(input.filter, { category: { $eq: 'e-bike' } });
  assert.equal(input.topK, 50);
});

test('empty search text is rejected', () => {
  assert.throws(() => buildQuery({ ...base, text: '   ' }), /Search text is missing/);
});

test('RRF prefers hits that appear in both lists', () => {
  const fused = reciprocalRankFusion([
    { keys: ['a', 'b', 'c'] },
    { keys: ['c', 'd', 'a'] },
  ]);
  assert.deepEqual(fused.slice(0, 2).map((f) => f.key).sort(), ['a', 'c']);
});

test('weight shifts the ranking', () => {
  const fused = reciprocalRankFusion([
    { keys: ['text-1', 'text-2'], weight: 2 },
    { keys: ['vec-1', 'vec-2'], weight: 1 },
  ]);
  assert.equal(fused[0].key, 'text-1');
});
