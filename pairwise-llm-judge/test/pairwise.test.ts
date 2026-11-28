// test/pairwise.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combine, judgePair } from '../src/pairwise.ts';
import { computeMetrics } from '../src/metrics.ts';
import { parsePairVerdict } from '../src/prompt.ts';
import type { PairJudge } from '../src/judge.ts';

test('a win only counts if both orders agree', () => {
  assert.deepEqual(combine('A', 'B'), { consistent: true, outcome: 'candidate' });
  assert.deepEqual(combine('B', 'A'), { consistent: true, outcome: 'baseline' });
});

test('a contradiction after the swap becomes a tie', () => {
  assert.deepEqual(combine('A', 'A'), { consistent: false, outcome: 'tie' });
  assert.deepEqual(combine('B', 'B'), { consistent: false, outcome: 'tie' });
});

test('an unreadable verdict counts as inconsistent', () => {
  assert.deepEqual(combine('UNKNOWN', 'B'), { consistent: false, outcome: 'tie' });
});

test('the parser recognises A, B and TIE', () => {
  assert.equal(parsePairVerdict('Reasoning …\n<verdict>B</verdict>'), 'B');
  assert.equal(parsePairVerdict('<verdict> tie </verdict>'), 'TIE');
  assert.equal(parsePairVerdict('I think A is better.'), 'UNKNOWN');
});

test('a judge that always picks slot A stands out', async () => {
  const alwaysA: PairJudge = async () => 'A';
  const pair = { id: 'x', question: 'q', baseline: 'b', candidate: 'c' };
  const results = [await judgePair(alwaysA, pair), await judgePair(alwaysA, { ...pair, id: 'y' })];
  const m = computeMetrics(results);
  assert.equal(m.consistency, 0);
  assert.equal(m.firstSlotShare, 1);
  assert.equal(m.ties, 2);
  assert.equal(m.candidateScore, 0.5);
});
