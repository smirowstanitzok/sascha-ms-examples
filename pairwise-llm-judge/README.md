# Pairwise LLM judge with position swap

Example code for the article **“Pairwise LLM judge: detect and measure position bias”**:

- English: https://sascha-ms.de/en/pairwise-llm-judge-position-bias
- German: https://sascha-ms.de/2026/4267-paarweiser-llm-judge

A small TypeScript project that compares a baseline and a candidate answer with an LLM judge. Every pair is rated twice, once with the slots swapped. A win only counts if both runs agree; contradictions become a tie. The script reports position consistency, the share of slot A verdicts and a candidate score.

## Files

| File | Purpose |
| --- | --- |
| `data/pairs.jsonl` | Eight fictional test pairs (bike rental support assistant) |
| `src/types.ts` | Shared types |
| `src/prompt.ts` | Judge prompt and verdict parser |
| `src/judge.ts` | Claude judge (Messages API) and a deliberately biased mock judge |
| `src/pairwise.ts` | Position swap and conservative tie rule |
| `src/metrics.ts` | Position consistency, slot A share, candidate score |
| `src/compare.ts` | Runs the comparison and exits with code 1 below the consistency gate |
| `test/pairwise.test.ts` | Tests with the Node.js test runner |

## Run it

```bash
npm install
npm test
npm run compare:mock          # no API key needed
export ANTHROPIC_API_KEY="your-key"
npm run compare               # real judge, model via JUDGE_MODEL (default claude-sonnet-5-5)
```

Optional: `MIN_CONSISTENCY=0.9 npm run compare` changes the gate (default 0.8).

## Tested with

- Node.js 22.23 (TypeScript runs without a build step from 22.18)
- TypeScript 5.9, @anthropic-ai/sdk 1.14.0
