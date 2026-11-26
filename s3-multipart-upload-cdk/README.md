# S3 multipart upload with presigned URLs and AWS CDK

Example code for the article **[S3 multipart upload with presigned URLs and AWS CDK](https://sascha-ms.de/en/s3-multipart-upload-presigned-urls-cdk)** on sascha-ms.de (German version: [S3 Multipart Upload: große Dateien mit Presigned URLs](https://sascha-ms.de/2026/2765-s3-multipart-upload-presigned-urls)).

A small serverless API for a fictional audiobook archive: the browser uploads large files (up to 20 GiB) directly to S3 in parts. Lambda only plans the upload, signs one URL per part (with the part size in the signature), checks all parts with `ListParts` and completes or aborts the upload. DynamoDB keeps the upload state, a lifecycle rule removes abandoned uploads after one day.

## Files

| File | Purpose |
| --- | --- |
| `src/plan.ts` | Pure logic: validate the request, plan part size and count, clean file names |
| `src/store.ts` | Small DynamoDB store for the upload state (with TTL and conditional close) |
| `src/handlers.ts` | Four endpoints: start, sign parts, complete, abort |
| `src/index.ts` | Lambda entry point (S3 client with `requestChecksumCalculation: "WHEN_REQUIRED"`) |
| `lib/upload-stack.ts` | CDK stack: S3 bucket with CORS and lifecycle rule, DynamoDB table, four Lambda functions, HTTP API |
| `bin/app.ts` | CDK app |
| `web/upload-client.ts` | Browser client: parallel part uploads with retries and cleanup |
| `web/main.ts` | Wiring the client to a file input |
| `test/*.test.ts` | Vitest tests for the plan, the handlers (fake S3, no AWS account needed), the client and the stack |

## Run it

```bash
npm install
npx tsc --noEmit
npm test
```

Expected result: 4 test files, 14 tests passed.

Deploy (needs an AWS account and a bootstrapped CDK environment; the bucket is retained on `cdk destroy`):

```bash
npx cdk deploy -c allowedOrigin=https://archive.example.org
```

Without `allowedOrigin`, the stack only allows `http://localhost:5173`.

## Tested with

Node.js 22, aws-cdk-lib 2.278, AWS SDK for JavaScript 3.1178, TypeScript 7.0, Vitest 5.1 (checked on 2026-11-26 with type check, tests and `cdk synth`, not against a real AWS account).
