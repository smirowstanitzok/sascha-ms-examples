// src/types.ts
export type Verdict = 'pass' | 'fail' | 'unknown';
export type HumanLabel = 'pass' | 'fail';

export interface LabeledAnswer {
  id: string;
  question: string;
  answer: string;
  // Human verdict per criterion – this is the gold standard
  labels: Record<string, HumanLabel>;
}

export interface Criterion {
  key: string;
  name: string;
  rubric: string;
}

export interface JudgeResult {
  verdict: Verdict;
  reason: string;
}
