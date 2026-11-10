# Claude Fable 5.2 migration for TypeScript backends

Example code for the article
[Claude Fable 5.2 migration for TypeScript backends](https://sascha-ms.de/en/claude-fable-5-2-migration-typescript)
(German version: [Claude Fable 5.2: Migration für TypeScript-Backends](https://sascha-ms.de/2026/2564-claude-fable-5-2-migration)).

A small module that helps you switch to Claude Fable 5.2:

- model profiles with explicit `effort` and `max_tokens`
- a check function that finds request parameters Fable 5.2 rejects with a 400
- a wrapper that detects refusals (`stop_reason: "refusal"`) and falls back to another model

## Files

| File | Purpose |
| --- | --- |
| `src/models.ts` | Model profiles (`daily`, `heavy`, `bulk`) and fallback models |
| `src/migration-check.ts` | `checkForFable()` – reports parameters that cause a 400 |
| `src/ask-claude.ts` | `askClaude()` – streaming call with refusal detection and fallback |
| `src/example.ts` | Real call with a fictional bike rental task |
| `test/*.test.ts` | Vitest tests with a fake client (no network, no cost) |

## Run

```bash
npm install
npm run typecheck
npm test

# real call (needs a Claude API key)
export ANTHROPIC_API_KEY=your-key
npm run example
```

## Tested versions

- Node.js 22
- @anthropic-ai/sdk 1.7.0
- TypeScript 5.9.3
- Vitest 4.0.18

Type check and all 8 tests pass. The real API call was only tested up to authentication.
