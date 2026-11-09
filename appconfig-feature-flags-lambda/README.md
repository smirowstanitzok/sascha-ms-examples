# AppConfig feature flags in Lambda with CDK

Example code for the article **“AppConfig feature flags in Lambda: safe rollouts”**:

- English: https://sascha-ms.de/en/appconfig-feature-flags-lambda
- German: https://sascha-ms.de/2026/1709-appconfig-feature-flags-lambda

A small HTTP API for a fictional cinema calculates ticket prices. Two AWS AppConfig feature flags control its behavior:

- `sunday-discount` – a Sunday discount whose percentage is a validated flag attribute (0–50)
- `sales-stop` – a kill switch that makes the API answer with 503

The Lambda function reads the flags through the AWS AppConfig Agent Lambda extension (`localhost:2772`) and falls back to safe defaults if the agent does not answer. Changes roll out with a linear deployment strategy (20 % every 2 minutes, 5 minutes bake time) and roll back automatically when a CloudWatch alarm on function errors fires.

## Files

| File | Purpose |
| --- | --- |
| `flags/feature-flags.json` | Feature flag definitions and values (`AWS.AppConfig.FeatureFlags` format) |
| `src/flags.ts` | Reads the flags from the local agent with timeout and safe defaults |
| `src/pricing.ts` | Pure pricing logic, no AWS dependencies |
| `src/price-handler.ts` | Lambda handler for `GET /price` |
| `lib/cinema-flags-stack.ts` | CDK stack: AppConfig application, environment, profile, strategy, alarm, Lambda, HTTP API |
| `bin/app.ts` | CDK app entry point |
| `test/flags.test.ts` | Tests with the Node.js test runner and a fake agent |

## Run it

```bash
npm install
npm run build      # type check
npm test           # 4 tests
npx cdk synth
npx cdk deploy     # needs AWS credentials and a bootstrapped account
```

The AppConfig layer ARN comes from `Application.getLambdaLayerVersionArn()`. That list ships with the CDK version and can lag behind the latest extension version. To use a newer one:

```bash
npx cdk deploy -c appConfigLayerArn=arn:aws:lambda:<region>:<account>:layer:AWS-AppConfig-Extension-Arm64:<version>
```

Clean up with `npx cdk destroy`.

## Tested with

Node.js 22, TypeScript 7.0, aws-cdk-lib 2.275.0, aws-cdk CLI 2.1147.0 (type check, tests and `cdk synth`; deployment not tested in this repository).
