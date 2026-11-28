# Lambda canary deployments with AWS CDK

Example code for the article **Lambda canary deployments with CDK and alarm rollback**:

- English: https://sascha-ms.de/en/lambda-canary-deployments-cdk
- German: https://sascha-ms.de/2026/4291-lambda-canary-deployment

A small pricing API for a fictional canoe rental. Every new version of the Lambda function first receives 10 % of the traffic via CodeDeploy. A pre-traffic hook runs smoke tests against the new version, and a CloudWatch alarm on the error rate rolls the deployment back automatically.

## Files

| File | Purpose |
| --- | --- |
| `lib/boat-rental-stack.ts` | CDK stack: function, alias `live`, HTTP API, error-rate alarm, pre-traffic hook, CodeDeploy deployment group |
| `bin/app.ts` | CDK app entry point |
| `src/pricing.ts` | Pure pricing logic |
| `src/price-handler.ts` | Lambda handler for `GET /price?boat=kayak&hours=2` |
| `src/pre-traffic-hook.ts` | CodeDeploy `BeforeAllowTraffic` hook with smoke tests |
| `test/pricing.test.ts` | Unit tests for pricing, handler and hook checks |
| `test/stack.test.ts` | CDK template assertions |

## Run

```bash
npm install
npx tsc --noEmit
npx vitest run        # 8 tests, no AWS account needed
npx cdk synth
npx cdk deploy        # needs AWS credentials and cdk bootstrap
```

To try the rollback, add `if (hours > 48) throw new Error('Simulated bug in version 2');` before the price calculation in `src/price-handler.ts`, deploy again and send requests with `hours=60` while CodeDeploy shifts traffic.

## Tested with

Node.js 22, aws-cdk-lib 2.278.0, aws-cdk 2.1149.0, TypeScript 5.9, Vitest 5.1, esbuild 0.28.
