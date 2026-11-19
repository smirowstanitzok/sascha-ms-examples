# Bike rental API on Lambda Web Functions (CDK L2 construct)

Extension of the example in this folder, from steps 5 and 6 of the article.

- Article: [Lambda Web Functions: Express App With CDK & CloudFront](https://sascha-ms.de/en/lambda-web-functions-cdk-cloudfront) (English)
- German original: [Lambda Web Functions: Express-App mit CDK & CloudFront](https://sascha-ms.de/2026/208-lambda-web-functions-cdk-cloudfront)

A small Express 5 rental API for a fictional bike rental shop. It shows a request context with `AsyncLocalStorage`, one shared DynamoDB client per environment and conditional writes, so that exactly one of many parallel requests can rent a bike. The infrastructure uses the L2 construct `lambda.WebFunction` from `aws-cdk-lib` 2.276.0 or later, with CloudFront and origin access control in front.

| Path | Content |
| --- | --- |
| `app/src/index.ts` | Express routes: create, get and rent bikes |
| `app/src/bike-store.ts` | DynamoDB store with conditional writes, in-memory fallback without `TABLE_NAME` |
| `app/src/request-context.ts` | Request ID per request with `AsyncLocalStorage` |
| `app/scripts/parallel-rent.mjs` | Fires 20 parallel rental requests, exactly one must win |
| `infra/lib/bike-rental-stack.ts` | CDK stack: DynamoDB table, WebFunction, CloudFront with OAC |

## Run it locally (no AWS account needed)

```bash
cd app
npm install
npm run typecheck && npm run build
npm start
# in a second terminal:
node scripts/parallel-rent.mjs
```

Expected output: `200 (rented): 1, 409 (already taken): 19`

## Deploy

```bash
cd app && npm run build
cd ../infra
npm install
npx tsc --noEmit
npx cdk synth
npx cdk deploy
node ../app/scripts/parallel-rent.mjs https://<CloudFrontUrl>
```

The stack deploys to eu-west-1. Deploying creates AWS resources that may cost money; remove them with `npx cdk destroy`. The log group of the web function is retained and has to be deleted by hand.

Checked on 2026-11-19 with aws-cdk-lib 2.277.0, @aws-sdk/client-dynamodb 3.1172.0, Express 5.3.0, Node.js 22.23.5 (type check, local parallel test, cdk synth). Not deployed to a real account.
