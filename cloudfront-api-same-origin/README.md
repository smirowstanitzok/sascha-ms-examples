# CloudFront in front of API Gateway: no more CORS

Example code for the article:

- English: [CloudFront in Front of API Gateway: No More CORS](https://sascha-ms.de/en/cloudfront-in-front-of-api-gateway)
- German: [CloudFront vor API Gateway: Frontend und API ohne CORS](https://sascha-ms.de/2026/3249-cloudfront-vor-api-gateway)

One CloudFront distribution serves a static frontend from a private S3 bucket (`/*`) and an HTTP API with Lambda (`/api/*`). Because both share one domain, browser calls are same-origin requests: no CORS headers, no preflight, and cookies can use `SameSite=Strict`.

## Files

| File | Purpose |
| --- | --- |
| `bin/app.ts` | CDK app entry point |
| `lib/library-web-stack.ts` | S3 bucket, Lambda, HTTP API, CloudFront Function and distribution |
| `functions/api.ts` | Lambda handler with `/api/books`, `/api/session` and `/api/me` |
| `web/index.html` | Minimal frontend that calls the API with relative paths |
| `test/api.test.ts` | Unit tests for the handler (Node test runner via tsx) |

## Run it

```bash
npm install
npm run build   # type check
npm test        # unit tests
npx cdk synth   # CloudFormation template, no AWS credentials needed
npx cdk bootstrap
npx cdk deploy
```

Then open the `SiteUrl` output and check the network tab: there is no OPTIONS request.

Run `npx cdk destroy` to remove everything again.

## Tested with

Node.js 22, aws-cdk-lib 2.277.0, aws-cdk 2.1148.1, TypeScript 5.9.3, esbuild 0.28.2, tsx 4.23.
