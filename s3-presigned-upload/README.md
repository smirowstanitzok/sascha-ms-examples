# S3 presigned URL: secure file uploads with Lambda

Example code for the article
**[S3 presigned URL: secure file uploads with Lambda](https://sascha-ms.de/en/s3-presigned-url-upload-lambda)**
(German version: [S3 Presigned URL: sicherer Datei-Upload mit Lambda](https://sascha-ms.de/2026/2751-s3-presigned-url-upload-lambda)).

A fictional bike rental lets customers upload damage photos. A Lambda function signs a presigned POST form
(size and Content-Type enforced by S3), the browser uploads straight to S3, and an S3 event triggers a second
Lambda function that checks the magic bytes and moves valid photos from `eingang/` (inbox) to `geprueft/` (checked).

## Files

| File | Purpose |
| --- | --- |
| `serverless.yml` | Serverless Framework v4: HTTP API, bucket with CORS/lifecycle, S3 event, least-privilege IAM |
| `src/upload-url.ts` | Lambda handler that returns a presigned POST form |
| `src/check-upload.ts` | Lambda handler for the S3 event: checks magic bytes, moves or deletes the file |
| `src/lib/file-types.ts` | Allowed image types and magic-byte detection |
| `src/put-url.ts` | Presigned PUT URL with `requestChecksumCalculation: "WHEN_REQUIRED"` |
| `web/upload.ts` | Browser upload with `FormData` |
| `test/*.test.ts` | Vitest tests (no AWS account needed) |

## Run

```bash
npm install
npx tsc --noEmit
npx vitest run
serverless deploy --stage dev
```

Tested with Node.js 22, TypeScript 7.0.2, Vitest 5.1.0, AWS SDK for JavaScript 3.1167.0 and Serverless Framework v4 syntax
(template validated with `serverless package`).
