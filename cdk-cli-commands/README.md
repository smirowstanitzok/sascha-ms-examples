# AWS CDK CLI commands: every command explained

Example code for the article:

- English: https://sascha-ms.de/en/cdk-cli-commands
- German: https://sascha-ms.de/2026/3314-cdk-cli-befehle

A small CDK app for a fictional bike rental shop with two stacks, used to walk through the CDK CLI from `cdk init` to `cdk destroy`.

## Files

| File | Purpose |
| --- | --- |
| `bin/radverleih.ts` | CDK app entry point, wires up both stacks |
| `lib/radverleih-stack.ts` | `RadverleihDaten` (DynamoDB table) and `RadverleihApi` (Lambda function with IAM-protected function URL) |
| `test/radverleih.test.ts` | Jest test with template assertions |
| `scripts/ci-deploy.sh` | Example pipeline step: synth, drift check, deploy without prompts |
| `cdk.json` | App command and `cdk watch` settings |

## Run it

```bash
npm install
npx cdk ls --show-dependencies
npx cdk synth --quiet
npm test
```

Deploying needs an AWS account and a bootstrapped environment:

```bash
npx cdk bootstrap aws://123456789012/eu-central-1
npx cdk diff
npx cdk deploy --all --outputs-file cdk-outputs.json
npx cdk destroy --all
```

`cdk.json` deliberately contains no feature flags. To set the recommended values for a new project, run:

```bash
npx cdk flags --unstable=flags --set --recommended --unconfigured
```

The table uses `RemovalPolicy.DESTROY` – fine for a demo, not for production.

## Tested with

CDK CLI 2.1148.1, aws-cdk-lib 2.277.0, TypeScript 7.0, Node.js 22 (`cdk ls`, `cdk synth`, `tsc`, Jest). No deployment was performed.
