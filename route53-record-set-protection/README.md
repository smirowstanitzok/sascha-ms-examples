# Route 53 record set protection: DNS guard

Example code for the article **Route 53 Record Set Protection: Lock Critical DNS Records**

- English: https://sascha-ms.de/en/route-53-record-set-protection
- German: https://sascha-ms.de/2026/3007-route-53-record-set-protection

A small TypeScript project that

- defines the DNS records that must stay protected (`src/config.ts`),
- runs as a scheduled Lambda function (Serverless Framework v4) that recreates missing Route 53 record set protections and writes an EMF metric with an alarm,
- ships a script that changes a protected record safely: remove protection, apply change, wait for `INSYNC`, restore protection in a `finally` block.

## Files

| File | Purpose |
| --- | --- |
| `serverless.yml` | Lambda, schedule, IAM (list + create only) and CloudWatch alarm |
| `src/config.ts` | Desired protections for the fictional zone `bikerental.example` |
| `src/protections.ts` | Name normalization, diff, batching (max. 100 per request) |
| `src/route53.ts` | SDK calls with paginator |
| `src/handler.ts` | Lambda handler with Embedded Metric Format output |
| `src/change-protected.ts` | CLI script for planned changes to protected records |
| `test/protections.test.ts` | Unit tests (Node test runner) |

## Run

```bash
npm install
npm run typecheck
npm test
serverless deploy --param="hostedZoneId=Z0123456789EXAMPLE"
serverless invoke -f check
npm run change -- Z0123456789EXAMPLE mx-change.json
```

Tested with Node.js 22, TypeScript 5.9, `@aws-sdk/client-route-53` 3.1169.0 and Serverless Framework 4 (November 2026).
