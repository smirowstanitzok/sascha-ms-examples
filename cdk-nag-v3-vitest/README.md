# cdk-nag v3: Security checks in CDK tests with Vitest

Example code for the article:

- English: [cdk-nag v3: Security Checks in CDK Tests with Vitest](https://sascha-ms.de/en/cdk-nag-v3-vitest)
- German: [cdk-nag v3: Security-Checks im CDK-Test mit Vitest](https://sascha-ms.de/2026/2554-cdk-nag-v3-vitest)

A small bike rental stack (SQS queue with DLQ, Lambda function, DynamoDB table, S3 bucket for receipts) checked with the cdk-nag v3 rule packs `AwsSolutions` and `Serverless` plus a custom `RentalChecks` pack. Findings that cannot be fixed are acknowledged with `Validations.of(construct).acknowledge({ id, reason })`, and the tests use `validateScope()` to run the rules without a full synth.

## Files

| File | Purpose |
| --- | --- |
| `bin/app.ts` | CDK app, registers the rule packs with `Validations.of(app).addPlugins()` |
| `lib/rental-stack.ts` | The example stack including the acknowledgments with reasons |
| `lib/rental-rules.ts` | Custom `NagPack`: Lambda timeouts must not exceed 30 seconds |
| `test/helpers.ts` | Turns a `validateScope()` report into a flat list of findings |
| `test/rental-nag.test.ts` | Vitest tests: no open findings, reasons present, negative tests, full synth |

## Run

```bash
npm install
npm run typecheck
npm test
npm run synth
```

No AWS account is needed for tests and synth. `npx cdk deploy` requires AWS credentials and a bootstrapped account.

Tested with Node.js 22, aws-cdk-lib 2.275.0, cdk-nag 3.0.2, aws-cdk 2.1148.0, Vitest 5.1.0 and TypeScript 7.0.2 (7 tests green, `tsc --noEmit` without errors, `cdk synth` successful). Not deployed.
