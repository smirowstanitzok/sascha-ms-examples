// src/types.ts
export type Slot = 'A' | 'B';
export type RawVerdict = Slot | 'TIE' | 'UNKNOWN';

export interface Pair {
  id: string;
  question: string;
  baseline: string;  // answer from the current version
  candidate: string; // answer from the new version
}

export type Outcome = 'candidate' | 'baseline' | 'tie';

export interface PairResult {
  id: string;
  firstRun: RawVerdict;  // candidate sits in slot A
  secondRun: RawVerdict; // candidate sits in slot B
  consistent: boolean;
  outcome: Outcome;
}
