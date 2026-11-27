// src/prompt.ts
import type { Criterion, JudgeResult } from './types.ts';
import { POLICY } from './criteria.ts';

export function buildJudgePrompt(c: Criterion, question: string, answer: string): string {
  return `You are grading answers from the support assistant of a bike rental shop.
Check only the criterion "${c.name}".

<rules>
${POLICY}
</rules>

<rubric>
${c.rubric}
</rubric>

<question>
${question}
</question>

<answer>
${answer}
</answer>

If the information is not enough to judge with confidence, answer "unknown".
Explain your reasoning first in at most two sentences, then give the verdict.
Reply only with JSON in exactly this shape:
{"reason": "...", "verdict": "pass" | "fail" | "unknown"}`;
}

// Parse defensively: anything that is not unambiguous becomes "unknown".
export function parseJudgeOutput(text: string): JudgeResult {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { verdict: 'unknown', reason: 'No JSON response received' };
  try {
    const data = JSON.parse(match[0]) as { verdict?: unknown; reason?: unknown };
    const v = String(data.verdict ?? '').toLowerCase();
    const verdict = v === 'pass' || v === 'fail' ? v : 'unknown';
    return { verdict, reason: String(data.reason ?? '') };
  } catch {
    return { verdict: 'unknown', reason: 'JSON could not be parsed' };
  }
}
