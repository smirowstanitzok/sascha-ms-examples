# LLM as a judge: calibrate your grader with TypeScript

Example code for the article "LLM as a judge: calibrate your grader with TypeScript".

- English article: https://sascha-ms.de/en/llm-as-a-judge-calibration
- German article: https://sascha-ms.de/2026/4213-llm-as-a-judge-kalibrieren

A small TypeScript project that compares the verdicts of an LLM judge (Claude API) with human labels and reports agreement, Cohen's kappa, false pass / false fail rates and the share of "unknown" verdicts. A deterministic mock judge lets you run everything without an API key.

## Files

| File | Purpose |
| --- | --- |
| `src/criteria.ts` | Rental rules of the fictional bike shop and one rubric per criterion |
| `src/prompt.ts` | Judge prompt and defensive JSON parser |
| `src/judge.ts` | Claude judge (`JUDGE_MODEL`, default `claude-sonnet-5-5`) and mock judge |
| `src/metrics.ts` | Confusion matrix, agreement, kappa, error rates, dev/test split |
| `src/calibrate.ts` | Calibration run with limited concurrency, writes `disagreements-<set>.json` |
| `data/labels.jsonl` | 24 hand-labeled example answers |
| `test/*.test.ts` | Tests with the Node.js test runner |

## Run

Requires Node.js 22.18 or newer (TypeScript runs directly via type stripping).

```bash
npm install
npm test
npm run calibrate:mock            # dev set, mock judge
SET=test npm run calibrate:mock   # held-out test set
export ANTHROPIC_API_KEY=...      # then the real judge
npm run calibrate
```

Tested with Node.js 22.23, TypeScript 5.9.3, @anthropic-ai/sdk 1.14.0.
