# CloudFront Functions vs Lambda@Edge

Example code for the article **CloudFront Functions vs Lambda@Edge: which one fits when**:

- English: https://sascha-ms.de/en/cloudfront-functions-vs-lambda-edge
- German: https://sascha-ms.de/2026/3294-cloudfront-functions-vs-lambda-edge

A fictional bike rental shop ("Speichenwerk") serves its website from S3 through CloudFront:

- A **CloudFront Function** (JavaScript runtime 2.0) redirects old URLs using a **KeyValueStore** and appends `index.html` to folder URLs.
- A **Lambda@Edge** function on the viewer request protects `/mitglieder/*` and verifies the Amazon Cognito ID token from the `id_token` cookie with `aws-jwt-verify`.

## Files

| File | Purpose |
| --- | --- |
| `functions/redirects.js` | CloudFront Function: redirects from the KeyValueStore, pretty URLs |
| `redirects.json` | Initial data for the KeyValueStore |
| `edge/config.ts` | Configuration that is inlined at build time (no environment variables in Lambda@Edge) |
| `edge/member-auth.ts` | Lambda@Edge handler: JWT check for the members area |
| `scripts/build-edge.mjs` | Bundles the Lambda@Edge function with esbuild |
| `lib/bike-site-stack.ts` | CDK stack: S3, KeyValueStore, CloudFront Function, EdgeFunction, distribution |
| `bin/app.ts` | CDK app |
| `test/redirects.test.mjs` | Local test of the CloudFront Function with a fake KeyValueStore |
| `test/member-auth.test.ts` | Local test of the Lambda@Edge function with a locally signed token |
| `events/old-url.json` | Test event for `aws cloudfront test-function` |
| `site/` | Minimal sample pages |

## Run

```bash
npm install
npm test
npm run typecheck

export USER_POOL_ID=eu-central-1_AbCdEf123
export USER_POOL_CLIENT_ID=your-client-id
npm run synth

# deploy (needs AWS credentials; bootstrap both Regions once)
npx cdk bootstrap aws://123456789012/eu-central-1 aws://123456789012/us-east-1
npm run deploy
```

Deleting the stacks can fail at first because CloudFront needs a few hours to remove the Lambda@Edge replicas. Just run `npx cdk destroy --all` again later.

## Tested with

Node.js 22, aws-cdk-lib 2.277.0, aws-cdk 2.1148.1, aws-jwt-verify 5.2.1, esbuild 0.28.2, TypeScript 5.9.3, tsx 4.23 (November 2026).
