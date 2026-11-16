# AWS Lambda layers: when they still pay off

Example code for the article [AWS Lambda layers: when they still pay off in 2026](https://sascha-ms.de/en/aws-lambda-layers) (German version: [Lambda Layers: Wann sie sich 2026 noch lohnen](https://sascha-ms.de/2026/3281-lambda-layers)).

A fictional bike rental shop returns PDF receipts through an HTTP API. `pdfkit` loads fonts and a color profile from its package folder at runtime, so it cannot be bundled cleanly with esbuild. It lives in its own Lambda layer instead. Logging comes from the managed Powertools layer.

## Files

| Path | Purpose |
| --- | --- |
| `serverless.yml` | Serverless Framework v4 service with the own layer, the Powertools layer and esbuild `external` + `exclude` |
| `layers/pdf/nodejs/package.json` | Layer contents (pdfkit only) |
| `scripts/build-layer.sh` | Installs the layer dependencies into `layers/pdf/nodejs/node_modules` |
| `scripts/smoke.sh` | Bundles the function like the framework and runs it with `NODE_PATH` pointing to the layer |
| `src/receipt.ts` | Lambda handler that creates the PDF receipt |
| `src/receipt.test.ts` | Vitest unit tests |
| `cdk/` | The same setup with AWS CDK (`LayerVersion` + `NodejsFunction`) |

## Run it

```bash
npm install
npm test
npm run build:layer
npm run smoke        # expected: Status 200 | PDF bytes ...
```

Deploy with Serverless Framework v4 (needs AWS credentials and a Serverless account):

```bash
npm run deploy
```

Or with AWS CDK (run `npm install` in the root folder first, the CDK app uses its `package-lock.json`):

```bash
npm run build:layer
cd cdk
npm install
npx cdk synth
```

## Tested with

TypeScript 7.0.2, Vitest 5.1.0, esbuild 0.28.2, pdfkit 0.20.2, @aws-lambda-powertools/logger 2.36.0, aws-cdk-lib 2.277.0 (`cdk synth`), Node.js 22 locally, target runtime `nodejs24.x`. Powertools layer version 51. The `serverless.yml` was validated as YAML, not deployed.
