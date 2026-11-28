// src/metrics.ts
import type { PairResult } from './types.ts';

export interface PairMetrics {
  pairs: number;
  consistency: number;     // share of pairs with the same result in both orders
  firstSlotShare: number;  // share of slot A verdicts among runs with a clear winner
  candidateWins: number;
  baselineWins: number;
  ties: number;
  candidateScore: number;  // wins plus half the ties, divided by all pairs
  naiveCandidateWins: number; // candidate wins if you only look at run 1
}

const round = (x: number): number => Math.round(x * 1000) / 1000;

export function computeMetrics(results: PairResult[]): PairMetrics {
  const pairs = results.length;
  const runs = results.flatMap((r) => [r.firstRun, r.secondRun]);
  const decided = runs.filter((v) => v === 'A' || v === 'B');
  const firstSlot = decided.filter((v) => v === 'A').length;
  const candidateWins = results.filter((r) => r.outcome === 'candidate').length;
  const baselineWins = results.filter((r) => r.outcome === 'baseline').length;
  const ties = pairs - candidateWins - baselineWins;
  return {
    pairs,
    consistency: pairs ? round(results.filter((r) => r.consistent).length / pairs) : 0,
    firstSlotShare: decided.length ? round(firstSlot / decided.length) : 0,
    candidateWins,
    baselineWins,
    ties,
    candidateScore: pairs ? round((candidateWins + ties / 2) / pairs) : 0,
    naiveCandidateWins: results.filter((r) => r.firstRun === 'A').length,
  };
}
