# AWS API Portal gap scanner

Example code for the article:

- English: [AWS API Portal: Find and Secure Shadow APIs](https://sascha-ms.de/en/aws-api-portal-shadow-apis/)
- German: [AWS API Portal: Schatten-APIs finden und absichern](https://sascha-ms.de/2026/4037-aws-api-portal-schatten-apis/)

AWS API Portal (Amazon API Gateway, launched 2026-11-23) discovers APIs behind API Gateway REST APIs, Application Load Balancer and CloudFront. It does **not** discover API Gateway HTTP APIs, WebSocket APIs or Lambda function URLs that are called directly, and it only sees `ANY` methods and `{proxy+}` paths after real traffic. This small scanner lists exactly those endpoints for one Region, rates them (`high` = public without auth, `medium` = invisible to API Portal, `info` = only visible after traffic) and sends a weekly report via SNS. The example domain is a fictional bike rental.

## Files

| File | Purpose |
| --- | --- |
| `src/gaps.ts` | Pure logic: turns HTTP APIs, function URLs and REST methods into findings, formats the report |
| `src/collect.ts` | Read-only AWS SDK v3 calls with full pagination |
| `src/handler.ts` | Lambda handler: scan, log, publish to SNS when something is `high` or `medium` |
| `src/cli.ts` | Local run, exit code 1 on `high` findings |
| `test/gaps.test.ts` | Unit tests with the Node.js test runner (no AWS account needed) |
| `serverless.yml` | Serverless Framework v4: weekly schedule, least-privilege role, SNS topic with email subscription |

## Run

```bash
npm install
npm test
npm run typecheck
AWS_PROFILE=my-profile AWS_REGION=eu-central-1 npm run scan
npx serverless deploy --region eu-central-1 --param="reportEmail=platform-team@example.com"
npx serverless invoke -f gapScan --region eu-central-1
```

Confirm the SNS subscription email, otherwise no reports arrive. Remove everything with `npx serverless remove`.

Notes:

- Node.js 22.18 or later runs the TypeScript files directly (type stripping), no build step needed locally. Serverless Framework v4 bundles the handler with esbuild.
- All AWS calls are read-only (`apigateway:GET`, `lambda:ListFunctions`, `lambda:ListFunctionUrlConfigs`), plus `sns:Publish` on the report topic.
- The report contains endpoint URLs. Only send it to internal recipients.

## Tested with

- Node.js 22.23, TypeScript 5.9, AWS SDK for JavaScript v3 (3.1177), `node --test`: 7/7 passing, `tsc` without errors, esbuild bundle of the handler OK (2026-11-25)
- Not deployed against a real AWS account; the Serverless Framework config was validated syntactically only.
