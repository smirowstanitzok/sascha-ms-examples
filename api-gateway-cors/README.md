# API Gateway CORS: preflight and function URLs

Example code for the article
**[API Gateway CORS: fix preflight and function URL errors](https://sascha-ms.de/en/api-gateway-cors-preflight-function-urls)**
(German version: [API Gateway CORS: Preflight und Function URLs richtig](https://sascha-ms.de/2026/3236-api-gateway-cors-lambda)).

A fictional bike rental shows two ways to configure CORS for Lambda:

- an **HTTP API** with the Serverless Framework (`serverless.yml`), CORS configured once on the API
- a **Lambda function URL** with cookies in AWS CDK (`cdk/`), CORS with `allowCredentials`
- a small **preflight checker** (`src/cors-check.ts`) that sends an `OPTIONS` request like a browser and explains what is missing

## Files

| File | Purpose |
| --- | --- |
| `serverless.yml` | HTTP API with explicit CORS origins, headers, exposed headers and `maxAge` |
| `src/bikes.ts` | Handlers for `GET /bikes` and `POST /bookings` (no CORS headers in code) |
| `cdk/app.ts`, `cdk/favorites-stack.ts`, `cdk.json` | CDK app with a function URL and CORS incl. credentials |
| `src/favorites.ts` | Handler for the favorites list behind the function URL |
| `frontend/booking.ts`, `frontend/favorites.ts` | Browser calls with `fetch` (token and cookies) |
| `src/cors-check.ts` | Preflight checker (library + CLI) |
| `test/cors-check.test.ts` | Six tests with `node:test`, one against a local HTTP server |

## Run it

```bash
npm install
npm run typecheck
npm test
npm run synth          # cdk synth, no AWS credentials needed

# check a deployed endpoint
npx tsx src/cors-check.ts "https://<api-id>.execute-api.eu-central-1.amazonaws.com/bookings" \
  "https://app.bike-rental.example" POST content-type,authorization

# deploy (needs AWS credentials)
npx serverless deploy  # Serverless Framework v4
npx cdk deploy
```

## Tested with

Node.js 22, TypeScript 5.9, aws-cdk-lib 2.277, aws-cdk CLI 2.1148, tsx 4.23, esbuild 0.28.
