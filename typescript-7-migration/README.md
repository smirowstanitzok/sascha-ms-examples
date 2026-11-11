# Migrating to TypeScript 7 in Lambda and CDK projects

Example code for the article:

- English: https://sascha-ms.de/en/typescript-7-migration-lambda-cdk
- German: https://sascha-ms.de/2026/2670-typescript-7-migration

A small, made-up bike rental: a Lambda function behind an HTTP API calculates a rental price. The project runs on TypeScript 7 for type checking, esbuild for bundling, tsx instead of ts-node for the CDK app, and keeps TypeScript 6 (`@typescript/typescript6`) alongside for typescript-eslint.

## Files

| File | Purpose |
| --- | --- |
| `tsconfig.json` | TypeScript 7 compatible config (`bundler` resolution, `types: ["node"]`, `noEmit`) |
| `examples/tsconfig.before.json` | Typical TypeScript 5 config that fails under TypeScript 7 |
| `scripts/ts7-check.ts` | Dependency-free checker that lists TypeScript 7 pitfalls in a tsconfig |
| `src/rental.ts`, `src/shared/pricing.ts` | Lambda handler and shared module (imported via `@shared/*`) |
| `lib/rental-stack.ts`, `bin/app.ts`, `cdk.json` | AWS CDK app, started with tsx |
| `serverless.yml` | The same function with Serverless Framework v4 |
| `test/*.test.ts` | Vitest tests for pricing, checker and CDK stack |
| `eslint.config.mjs` | typescript-eslint with type-aware rules (uses TypeScript 6 API) |

## Run it

```bash
npm install
npm run check:ts7          # check tsconfig.json
npx tsx scripts/ts7-check.ts examples/tsconfig.before.json
npm run typecheck          # TypeScript 7
npm test                   # Vitest
npm run lint               # ESLint on TypeScript 6
npm run synth              # cdk synth
```

Deploying (`npx cdk deploy`) needs AWS credentials and a bootstrapped account. Remove the stack afterwards with `npx cdk destroy`.

## Tested with

Node.js 24, typescript 7.0.2, @typescript/typescript6 6.0.3, aws-cdk-lib 2.276.0, aws-cdk 2.1148.0, tsx 4.23.15, esbuild 0.28.2, typescript-eslint 8.72.2, eslint 9.39.5, vitest 5.1.0 (November 2026).
