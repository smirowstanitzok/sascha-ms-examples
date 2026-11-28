// src/pairwise.ts
import type { Outcome, Pair, PairResult, RawVerdict } from './types.ts';
import type { PairJudge } from './judge.ts';

// Turns a verdict into "who won", depending on where the candidate sat.
export function toOutcome(verdict: RawVerdict, candidateSlot: 'A' | 'B'): Outcome | null {
  if (verdict === 'TIE') return 'tie';
  if (verdict === 'UNKNOWN') return null;
  return verdict === candidateSlot ? 'candidate' : 'baseline';
}

// Conservative rule: a win only counts if it is the same in both orders.
export function combine(firstRun: RawVerdict, secondRun: RawVerdict): { consistent: boolean; outcome: Outcome } {
  const first = toOutcome(firstRun, 'A');
  const second = toOutcome(secondRun, 'B');
  if (first === null || second === null) return { consistent: false, outcome: 'tie' };
  if (first === second) return { consistent: true, outcome: first };
  return { consistent: false, outcome: 'tie' };
}

export async function judgePair(judge: PairJudge, pair: Pair): Promise<PairResult> {
  const [firstRun, secondRun] = await Promise.all([
    judge(pair.question, pair.candidate, pair.baseline), // candidate in slot A
    judge(pair.question, pair.baseline, pair.candidate), // candidate in slot B
  ]);
  return { id: pair.id, firstRun, secondRun, ...combine(firstRun, secondRun) };
}
