# Node.js type stripping: run TypeScript without a build

Example code for the article **Node.js Type Stripping: Run TypeScript Without a Build**

- English: https://sascha-ms.de/en/node-js-type-stripping-typescript
- German: https://sascha-ms.de/2026/3708-node-js-type-stripping-typescript

A small, fictional bike rental pricing module that runs directly with `node` (no `tsx`, no `ts-node`, no build step). Type checking happens separately with `tsc`.

## Files

| File | Purpose |
| --- | --- |
| `package.json` | `"type": "module"`, subpath import `#src/*`, scripts |
| `tsconfig.json` | type checking only (`noEmit`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`) |
| `src/pricing.ts` | pricing logic, `as const` object instead of an enum |
| `src/rental-book.ts` | class without parameter properties |
| `src/handler.ts` | Lambda handler for a price quote |
| `scripts/price-report.ts` | report script, run with `node` |
| `data/rentals.json` | sample data |
| `test/*.test.ts` | tests for the built-in Node.js test runner |
| `serverless.yml` | Serverless Framework v4 deployment, esbuild bundles the handler |
| `cdk-app/` | AWS CDK app started with `"app": "node bin/app.ts"` |

## Run

```bash
npm install
npm run report   # node scripts/price-report.ts data/rentals.json
npm test         # node --test
npm run check    # tsc (type checking)
```

CDK app:

```bash
cd cdk-app
npm install
npx cdk synth
```

Deploy the Lambda function (optional, needs AWS credentials and Serverless Framework v4):

```bash
npx serverless deploy
```

## Tested with

- Node.js 22.23.5 and 26.13.1
- TypeScript 7.0.2
- aws-cdk-lib 2.277.0, AWS CDK CLI 2.1149.0
- esbuild bundle of the handler checked locally; the deployment itself was not run

Requires Node.js 22.18 or newer (type stripping enabled by default).
