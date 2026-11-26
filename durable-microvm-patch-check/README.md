# Durable Functions MicroVMs: test AI code safely

Example code for the article:

- English: [Durable Functions MicroVMs: test AI code safely](https://sascha-ms.de/en/durable-functions-microvms)
- German: [Durable Functions MicroVMs: KI-Code sicher testen](https://sascha-ms.de/2026/4087-durable-functions-microvms)

A fictional city library lets an AI coding agent propose patches for its lending app. A Lambda durable function uses `microvmSession` from the AWS Durable Execution SDK extensions (developer preview) to launch one Lambda MicroVM, sends it two jobs (`prepare`, `test`) and returns a verdict. The MicroVM runs the agent's tests with the built-in Node.js test runner.

> The extension and the worker are a **developer preview** (`0.1.0-alpha.0`). Do not use them for production workloads.

## Files

| Path | Purpose |
| --- | --- |
| `src/patch-check.ts` | Durable function: `microvmSession` with two jobs and error handling |
| `src/single-job.ts` | Minimal `microvm` example for a single job |
| `microvm/check.ts` | Writes patch files safely and runs `node --test` with time limit and output cap |
| `microvm/check.test.ts` | Local tests for the check logic (no AWS needed) |
| `microvm/app.ts` | Worker with the routes `/prepare` and `/test` (`@aws/durable-execution-sdk-js-compute-worker`) |
| `microvm/Dockerfile` | Image definition for the MicroVM |
| `lib/patch-check-stack.ts` | AWS CDK stack: artifact bucket, build role, MicroVM role, durable function with alias |
| `bin/app.ts` | CDK app |
| `scripts/build-image.sh` | Bundles the worker, uploads it and calls `create-microvm-image` |

## Run

```bash
npm install
npm test            # three local tests
npx tsc --noEmit    # type check
npx cdk deploy      # needs a bootstrapped account in a region with Lambda MicroVMs
AWS_REGION=us-east-1 ./scripts/build-image.sh
```

Then invoke the alias ARN from the `AliasArn` output with a `patch.json` (see article) and read the result with `aws lambda get-durable-execution`.

## Checked versions

- Node.js 22
- `@aws/durable-execution-sdk-js` 3.1.0
- `@aws/durable-execution-sdk-js-extensions` 0.1.0-alpha.0
- `@aws/durable-execution-sdk-js-compute-worker` 0.1.0-alpha.0
- `@aws-sdk/client-lambda-microvms` 3.1178.0
- `aws-cdk-lib` 2.278.0 (`cdk synth` checked)
