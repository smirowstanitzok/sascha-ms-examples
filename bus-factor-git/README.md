# Bus factor from Git history

Estimates the bus factor (truck factor) of a Git repository with TypeScript, following the approach by Avelino et al. (ICPC 2016): degree of authorship per file, then greedily remove the people who own the most files until less than 50% of the files are covered.

- Article (English): https://sascha-ms.de/en/bus-factor-knowledge-silos
- Artikel (Deutsch): https://sascha-ms.de/2026/2977-bus-faktor-im-team

## Files

| File | Purpose |
| --- | --- |
| `src/bus-factor.ts` | Reads `git log`, computes authorship, bus factor and knowledge silos per directory |
| `package.json` | Scripts `bus-factor` and `typecheck` |
| `tsconfig.json` | Strict TypeScript configuration |

## Run

```bash
npm install
npm run typecheck
npm run -s bus-factor -- /path/to/your/repo
```

Use a full clone (no `--depth`). Add a `.mailmap` to merge identities, and extend the `ignore` list for generated files.

## Tested with

Node.js 22, Git 2.43, TypeScript 7.0.2, tsx 4.23.

Please use the results within the team and not for performance reviews.
