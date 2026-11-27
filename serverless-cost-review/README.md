# Reduce serverless costs: a cost review in 6 steps

Example code for the article **[Reduce Serverless Costs: A Cost Review in 6 Steps](https://sascha-ms.de/en/reduce-serverless-costs)** (German original: [Serverless Kosten senken: Kostenreview in 6 Schritten](https://sascha-ms.de/2026/4168-serverless-kosten-senken)).

A fictional bike rental runs a small HTTP API on AWS Lambda. The `serverless.yml` shows the cost-related settings from the article: arm64, a starting memory size, log retention, JSON logs with a log level, stack tags for cost allocation and, in the `prod` stage only, an AWS Budget plus a Cost Anomaly Detection monitor with an email subscription. The read-only `cost-check` script scans an account region for common cost traps and prints a Markdown report.

## Files

| File | Purpose |
| --- | --- |
| `serverless.yml` | Serverless Framework v4 service with cost settings, budget and anomaly monitor |
| `src/availability.ts` | Example Lambda handler (fictional bike rental) |
| `cost-check/rules.ts` | Rules for functions and log groups (no AWS dependency) |
| `cost-check/index.ts` | Collects data via AWS SDK v3 and prints the report |
| `cost-check/rules.test.ts` | Tests with the built-in Node.js test runner |

## Run

```bash
npm install
npx tsc --noEmit
npm test                                   # 7 passing tests, no AWS credentials needed
export AWS_PROFILE=review AWS_REGION=eu-central-1
npm run cost-check > cost-report.md        # read-only
npx serverless deploy --stage prod --param="costEmail=team@example.com"
```

Permissions for the cost check: `lambda:ListFunctions`, `lambda:ListProvisionedConcurrencyConfigs`, `cloudwatch:GetMetricData`, `logs:DescribeLogGroups`. The budget tag filter only works after the `project` tag has been activated as a cost allocation tag.

Tested with Node.js 22.23, TypeScript 5.9, tsx 4.23 and @aws-sdk/client-* 3.1178 (type check and tests; no deployment against a real account).
