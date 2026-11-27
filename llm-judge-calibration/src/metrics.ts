// src/metrics.ts
import type { HumanLabel, Verdict } from './types.ts';

export interface Pair {
  human: HumanLabel;
  judge: Verdict;
}

export interface CalibrationReport {
  n: number;
  unknownRate: number; // share of "unknown" among all verdicts
  agreement: number; // agreement, pass/fail cases only
  kappa: number; // Cohen's kappa, pass/fail cases only
  falsePassRate: number; // human says fail, judge says pass
  falseFailRate: number; // human says pass, judge says fail
  confusion: { pp: number; pf: number; fp: number; ff: number }; // first letter = human
}

const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b);

export function calibrate(pairs: Pair[]): CalibrationReport {
  const decided = pairs.filter((p) => p.judge !== 'unknown');
  const confusion = { pp: 0, pf: 0, fp: 0, ff: 0 };
  for (const p of decided) {
    const key = `${p.human[0]}${p.judge[0]}` as keyof typeof confusion;
    confusion[key]++;
  }
  const n = decided.length;
  const observed = ratio(confusion.pp + confusion.ff, n);

  // Expected chance agreement from the marginal distributions
  const humanPass = ratio(confusion.pp + confusion.pf, n);
  const judgePass = ratio(confusion.pp + confusion.fp, n);
  const expected = humanPass * judgePass + (1 - humanPass) * (1 - judgePass);
  const kappa = expected === 1 ? (observed === 1 ? 1 : 0) : (observed - expected) / (1 - expected);

  return {
    n: pairs.length,
    unknownRate: ratio(pairs.length - n, pairs.length),
    agreement: observed,
    kappa,
    falsePassRate: ratio(confusion.fp, confusion.fp + confusion.ff),
    falseFailRate: ratio(confusion.pf, confusion.pp + confusion.pf),
    confusion,
  };
}

// Fixed split into dev and test set based on a hash of the ID.
// This way an example lands in the same set on every run.
export function splitOf(id: string, testShare = 0.3): 'dev' | 'test' {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 100 < testShare * 100 ? 'test' : 'dev';
}
