# TypeScript 7.1 beta: what is new and how to test it

**Article:** [TypeScript 7.1 Beta: What’s New and How to Test It](https://sascha-ms.de/en/typescript-7-1-beta) (English) · [German original](https://sascha-ms.de/2026/114-typescript-7-1-beta-testen)

Small examples for the TypeScript 7.1 beta: import attributes in ambient modules, the stricter check for distributive conditional types, the new `es2026` target and lib, and the preview of the new compiler API.

## Run it

```bash
npm install
npm run typecheck:beta   # type check with typescript@beta
npm run build:beta       # emits dist/handler.js
npm run check:runtime    # which ES2026 functions does your Node.js support?
```

`examples/tsconfig.node22.json` shows a safer lib setting for Node.js 22, `examples/github-workflow-typecheck.yml` runs the beta in GitHub Actions next to your installed version (copy it to `.github/workflows/`).
