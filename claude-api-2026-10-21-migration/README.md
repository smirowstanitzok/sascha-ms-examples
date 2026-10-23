# Claude API 2026-10-21: migrating to the new SDK

**Article:** [Claude API 2026-10-21: Migrating to the New SDK](https://sascha-ms.de/en/claude-api-2026-10-21-migration-new-sdk) (English) · [German original](https://sascha-ms.de/2026/352-claude-api-2026-10-21-migration)

Claude API version `2026-10-21` removes `temperature`, `top_p` and `top_k`, and the new SDKs (TypeScript 1.x) send the key as `Authorization: Bearer`. This folder contains the code from the article:

| File | What it does |
| --- | --- |
| `scripts/check-claude-migration.ts` | Scans a repository for code that breaks with the new API version (exit code 1 on findings, CI-ready) |
| `src/client.ts` | A typical call after the migration, without sampling parameters |
| `src/gateway-client.ts` | Interim client for gateways that only read `X-Api-Key` |
| `src/classify.ts` | Structured outputs with Zod instead of `temperature: 0` |
| `src/legacy-client.ts` | New SDK, old API version (last resort) |
| `test/contract.test.ts` | Contract test with a fake `fetch`: no API key, no costs |
| `examples/dependabot.yml` | Temporarily ignore the major update in Dependabot |

## Run it

```bash
npm install
npm run check      # scan src/ for affected code
npm run typecheck  # the compiler finds leftover parameters
npm test           # contract test, no network access
```

Expected test result: `# pass 1`, `# fail 0`.

Tested with Node.js 22, TypeScript 5 and `@anthropic-ai/sdk` 1.1.0.
