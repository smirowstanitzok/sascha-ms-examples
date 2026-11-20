# Node.js test runner: test Lambda handlers without Jest

Example project for the article:

- English: https://sascha-ms.de/en/node-js-test-runner-lambda
- German: https://sascha-ms.de/2026/3779-node-js-test-runner-lambda

A small AWS Lambda handler for a fictional bike rental shop (return a bike, calculate the fee) tested only with the built-in Node.js test runner (`node:test`): TypeScript via type stripping, `mock.fn`, `mock.method`, `mock.timers`, snapshots, coverage thresholds and a JUnit reporter. No Jest, no Vitest, no transpiler.

The code keeps the German identifiers from the original article: *Ausleihe* = rental, *Rückgabe* = return, *Gebühr* = fee, *Rad* = bike.

## Files

| File | Purpose |
| --- | --- |
| `src/gebuehr.ts` | Pure fee calculation (3 EUR per started hour, capped at 25 EUR per day) |
| `src/ausleihen.ts` | Repository interface and DynamoDB implementation |
| `src/rueckgabe.ts` | Lambda handler factory (`POST /ausleihen/{ausleiheId}/rueckgabe`) |
| `src/index.ts` | Lambda entry point wiring the handler to DynamoDB |
| `test/gebuehr.test.ts` | Table-driven tests for the fee calculation |
| `test/rueckgabe.test.ts` | Handler tests with `mock.fn`, `mock.method`, `mock.timers` and a snapshot |
| `test/rueckgabe.test.ts.snapshot` | Stored snapshot |

## Run

```bash
npm install
npm run typecheck
npm test
npm run test:coverage
npm run test:ci   # writes junit.xml
```

To recreate the snapshot after an intended change: `npm run test:update-snapshots`.

## Tested with

- Node.js 24.22.3
- TypeScript 7.0.2
- AWS SDK for JavaScript v3 3.1173.0

No AWS account or credentials are needed to run the tests. For deployment, bundle `src/index.ts` with esbuild (for example via the CDK `NodejsFunction` construct or Serverless Framework v4) and use the `nodejs24.x` runtime.
