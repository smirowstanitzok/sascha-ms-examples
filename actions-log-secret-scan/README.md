# Secrets in GitHub Actions logs: find and prevent leaks

Example code for the article:

- English: https://sascha-ms.de/en/secrets-github-actions-logs
- German: https://sascha-ms.de/2026/2621-github-actions-logs-secrets

A small TypeScript CLI that downloads the logs of recent GitHub Actions workflow runs via the REST API and searches them for typical secret patterns (AWS keys, GitHub and npm tokens, private keys, JWTs, passwords in URLs, Slack webhooks). Findings are printed in redacted form only.

## Files

| File | Purpose |
| --- | --- |
| `src/detectors.ts` | Detection rules, redaction and line-by-line scan |
| `src/scan-zip.ts` | Unzips a workflow log archive in memory and scans every text file |
| `src/scan-runs.ts` | CLI: lists completed runs, downloads logs, prints findings |
| `test/detectors.test.ts` | Vitest tests (test data is assembled at runtime) |
| `examples/deploy-safe.yml` | Example workflow with OIDC and `::add-mask::` for runtime and derived values |

## Run

```bash
npm install
npm test
export GITHUB_TOKEN=github_pat_YOUR_TOKEN   # fine-grained token, "Actions: read"
npm run scan -- --repo owner/name --days 30 --max 50
```

Exit code `0` means nothing was found, `1` means possible secrets were found, `2` means wrong usage.

If you find a real secret: rotate it first, check whether it was used, then delete the logs:

```bash
gh api -X DELETE repos/owner/name/actions/runs/RUN_ID/logs
```

## Tested with

Node.js 22.23, TypeScript 7.0.2, Vitest 5.1.0, tsx 4.23.15, fflate 0.8.3.
