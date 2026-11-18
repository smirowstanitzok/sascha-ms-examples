# Lambda Managed Instances with scale to zero

Example code for the article **“Lambda Managed Instances now scale to zero”**:

- English: https://sascha-ms.de/en/lambda-managed-instances-scale-to-zero
- German: https://sascha-ms.de/2026/3558-lambda-managed-instances-scale-to-zero

A fictional bike rental creates maintenance reports on Lambda Managed Instances (LMI). The function is configured with `MinExecutionEnvironments: 0`, so it scales to zero when idle. A small caller retries HTTP 429 throttles with exponential backoff while LMI starts a new environment, which can take a few minutes.

## Files

| File | Purpose |
|------|---------|
| `serverless.yml` | Serverless Framework v4: capacity provider, function with LMI settings, EventBridge Scheduler warm-up/cool-down |
| `cdk/app.ts` | The same setup with AWS CDK (`lambda.CapacityProvider` L2 construct) |
| `src/handler.ts` | Concurrency-safe handler (no mutable global state) |
| `src/backoff.ts` | Exponential backoff with full jitter that only retries throttles |
| `scripts/invoke.ts` | Synchronous invoke with backoff |
| `test/backoff.test.ts` | Unit tests with the built-in Node.js test runner |

## Run

```bash
npm install
npm run typecheck
npm test            # 5 tests, no AWS account needed
npm run cdk:synth   # synthesizes the CDK variant
```

Deploy with the Serverless Framework (enter your subnets and security group in `serverless.yml` first):

```bash
npx serverless deploy
aws lambda get-function-scaling-config \
  --function-name bike-rental-reports-dev-maintenanceReport \
  --qualifier '$LATEST.PUBLISHED'
npm run invoke
npx serverless remove
```

**Costs:** LMI runs EC2 instances in your account (EC2 price + 15 % management fee + request charges). Remove the stack after testing.

## Verified with

Node.js 22/24, TypeScript 7.0.2, aws-cdk-lib 2.277.0, cfn-lint 1.60.1 (CloudFormation validation). The Serverless Framework stack was validated as CloudFormation, not deployed.
