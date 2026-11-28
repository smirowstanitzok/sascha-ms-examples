// src/compare.ts
import { readFile } from 'node:fs/promises';
import type { Pair } from './types.ts';
import { createBiasedMockJudge, createClaudePairJudge } from './judge.ts';
import { judgePair } from './pairwise.ts';
import { computeMetrics } from './metrics.ts';

const MIN_CONSISTENCY = Number(process.env.MIN_CONSISTENCY ?? 0.8);

const raw = await readFile(new URL('../data/pairs.jsonl', import.meta.url), 'utf8');
const pairs: Pair[] = raw.trim().split('\n').map((line) => JSON.parse(line));

const judge = process.env.JUDGE_MOCK === '1' ? createBiasedMockJudge() : createClaudePairJudge();

const results = [];
for (const pair of pairs) {
  results.push(await judgePair(judge, pair)); // one after another so you don't hit the rate limit
}

for (const r of results) {
  const flag = r.consistent ? ' ' : '!';
  console.log(`${flag} ${r.id}  run 1: ${r.firstRun.padEnd(7)} run 2: ${r.secondRun.padEnd(7)} → ${r.outcome}`);
}

const m = computeMetrics(results);
console.log('');
console.log(`Pairs: ${m.pairs} · verdicts: ${m.pairs * 2}`);
console.log(`Position consistency: ${(m.consistency * 100).toFixed(1)} %`);
console.log(`Share of slot A (clear winner only): ${(m.firstSlotShare * 100).toFixed(1)} %`);
console.log(`Candidate wins: ${m.candidateWins} · baseline wins: ${m.baselineWins} · ties: ${m.ties}`);
console.log(`Candidate score: ${(m.candidateScore * 100).toFixed(1)} %`);
console.log(`For comparison, run 1 only: candidate wins ${m.naiveCandidateWins} of ${m.pairs}`);

if (m.consistency < MIN_CONSISTENCY) {
  console.error(`\nThe judge is too unstable (consistency below ${MIN_CONSISTENCY * 100} %). Check the prompt or model before you trust the result.`);
  process.exitCode = 1;
}
