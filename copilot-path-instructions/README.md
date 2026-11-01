# Path-specific Copilot custom instructions

Example code for the article:

- English: [Path-specific Copilot custom instructions: a guide](https://sascha-ms.de/en/path-specific-copilot-custom-instructions)
- German: [Copilot Custom Instructions pro Pfad richtig aufsetzen](https://sascha-ms.de/2026/1735-copilot-custom-instructions-pro-pfad)

A small TypeScript script that checks `.github/instructions/*.instructions.md` files: frontmatter present, `applyTo` set, every glob pattern matches at least one file, `excludeAgent` uses a documented value (`code-review`, `cloud-agent`). The `example/` folder contains a fictional bike rental repo with a complete set of instruction files.

## Files

| Path | Purpose |
|---|---|
| `scripts/check-instructions.ts` | The check script (exit code 1 on errors) |
| `test/check-instructions.test.ts` | vitest tests |
| `example/.github/copilot-instructions.md` | Repository-wide instructions |
| `example/.github/instructions/*.instructions.md` | Path-specific instructions |
| `example/AGENTS.md` | Agent instructions with commands |

## Run

```bash
npm install
npm test
npm run check:example
```

Expected output of the last command: `0 finding(s), 0 error(s)`.

To check your own repository, copy `scripts/check-instructions.ts` and run `npx tsx scripts/check-instructions.ts` from the repository root.

## Tested with

Node.js 22, TypeScript 5.9, vitest 3.2, picomatch 4.0, tsx 4.
