# CloudWatch Logs retention policy for the whole account

Example code for the article **“CloudWatch Logs retention policy for the whole account”**:

- English: https://sascha-ms.de/en/cloudwatch-logs-retention-policy
- German: https://sascha-ms.de/2026/2527-cloudwatch-logs-aufbewahrung

It contains a small TypeScript CLI that plans, previews (dry run) and applies account-level
CloudWatch Logs retention policies, plus an AWS CDK stack that manages the policies as code
through an `AwsCustomResource` (CloudFormation's `AWS::Logs::AccountPolicy` does not list
`RETENTION_POLICY` yet as of November 10, 2026).

## Files

| File | Purpose |
| --- | --- |
| `src/retention.ts` | Pure planning logic: effective retention, longest policy wins, plan per log group |
| `src/cli.ts` | CLI: `inventory`, `plan` (local plan + AWS dry run), `apply --yes` |
| `lib/log-retention-stack.ts` | CDK construct `AccountRetentionPolicy` and an example stack |
| `bin/app.ts` | CDK app entry point |
| `test/retention.test.ts` | Vitest tests for the planning logic |
| `test/stack.test.ts` | Template assertions for the CDK stack |

## Run it

```bash
npm install
npm test            # unit tests, no AWS account needed
npm run typecheck
npx cdk synth       # synthesize the CDK stack

# needs AWS credentials with logs:DescribeLogGroups, logs:DescribeAccountPolicies,
# logs:PutAccountPolicy and logs:PutRetentionPolicy
npx tsx src/cli.ts inventory
npx tsx src/cli.ts plan --name baseline-90d --days 90
npx tsx src/cli.ts apply --name baseline-90d --days 90 --yes
```

Options: `--prefix /aws/lambda` limits a policy to a log group name prefix,
`--mode NEW_ONLY` only affects log groups created after the policy, `--days never` sets `NEVER_EXPIRE`.

**Careful:** an account-level retention policy replaces the retention of every matching log group,
even if the log group's own setting is longer. Always run `plan` first.

## Tested with

Node.js 22, TypeScript 7.0.2, Vitest 5.1.0, AWS CDK 2.275.0, `@aws-sdk/client-cloudwatch-logs` 3.1165.0.
