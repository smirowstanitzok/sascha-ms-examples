# Change freeze gate for GitHub Actions

Example code for the article **“Year-end change freeze: checklist and CI gate”**

- English: https://sascha-ms.de/en/year-end-change-freeze-checklist-ci-gate
- German: https://sascha-ms.de/2026/4241-change-freeze-jahresende

A small TypeScript script reads freeze windows from `freeze.json` and stops production deployments during a change freeze. Exceptions (`hotfix`, `security`) are only allowed with a justification of at least 20 characters. The demo service is a fictional bike rental API deployed with the Serverless Framework v4.

## Files

| File | Purpose |
| --- | --- |
| `freeze.json` | Freeze windows with ISO timestamps (with offset) and allowed reasons |
| `scripts/freeze-check.ts` | Check script: `parseConfig`, `findActiveWindow`, `decide`, CLI entry point |
| `test/freeze-check.test.ts` | Tests with the Node.js test runner |
| `workflow/deploy.yml` | GitHub Actions workflow – copy it to `.github/workflows/deploy.yml` in your repository |
| `serverless.yml`, `src/status.ts` | Minimal demo service |

## Run it

```bash
npm install
npm test
npm run typecheck

# simulate a point in time inside the freeze
FREEZE_NOW=2026-12-27T10:00:00+01:00 npm run freeze-check

# exception with reason and justification
FREEZE_NOW=2026-12-27T10:00:00+01:00 OVERRIDE_REASON=hotfix \
  OVERRIDE_NOTE="Bookings are failing, fix for RAD-42" npm run freeze-check
```

The workflow expects the repository variable `AWS_DEPLOY_ROLE_ARN` (IAM role for GitHub OIDC) and the secret `SERVERLESS_LICENSE_KEY`.

## Tested with

Node.js 22, TypeScript 5.9, tsx 4.23 (tests and type check). The workflow and `serverless.yml` were validated as YAML; no deployment was run.
