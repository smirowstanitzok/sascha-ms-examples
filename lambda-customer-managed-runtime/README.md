# Lambda customer-managed runtimes

Example code for the article **“Lambda customer-managed runtimes: one runtime for all”**

- English: https://sascha-ms.de/en/lambda-customer-managed-runtimes
- German: https://sascha-ms.de/2026/3721-lambda-customer-managed-runtimes

A fictional bike rental (“Radwerk”): a platform team publishes a Node.js 24 runtime with a shared JSON logger (`@radwerk/logger`). The rental team uses it from a function via the runtime alias, once with the Serverless Framework and once with AWS CDK.

## Files

| Path | Purpose |
| --- | --- |
| `runtime/Dockerfile` | Runtime image based on `public.ecr.aws/lambda/nodejs:24` |
| `runtime/radwerk-logger/` | Shared logger that ends up in `/var/runtime/node_modules`, with type declaration and tests |
| `policies/ecr-policy.json` | ECR repository policy so Lambda can read the runtime images |
| `policies/runtime-share-org.json` | Resource-based policy to share the runtime with an AWS Organization |
| `scripts/setup-runtime.sh` | One-time setup: repository, policy, runtime, first version, aliases dev/test/prod |
| `scripts/publish-runtime.sh` | Build and push a new image, create a version, move the `dev` alias |
| `scripts/promote.sh` | Promote a version from one alias to the next (prints the rollback command) |
| `scripts/find-functions.sh` | List functions in the account that use the runtime |
| `consumer-sls/` | Consumer function with the Serverless Framework v4 (`resources.extensions`) |
| `consumer-cdk/` | Consumer function with AWS CDK v2 (`NodejsFunction` + property override) |

## Run it

```bash
# logger tests (no AWS needed)
node --test runtime/radwerk-logger/logger.test.js

# CDK consumer: type check and synth (no AWS needed)
cd consumer-cdk && npm install && npx tsc --noEmit && npx cdk synth -c stage=dev

# Serverless Framework consumer
cd consumer-sls && npm install && npx tsc --noEmit && npx serverless deploy --stage dev

# publisher side (needs Docker with buildx, AWS CLI with "aws lambda-core")
./scripts/setup-runtime.sh 2026-11-19.1
./scripts/publish-runtime.sh 2026-11-19.2
./scripts/promote.sh dev test
```

Replace the example account `111111111111` and the organization ID `o-exampleorg1` with your own values.

## Tested with

- Node.js 22.23.5, TypeScript 5.9, aws-cdk-lib 2.277.0: `tsc --noEmit` and `cdk synth` succeed (CDK prints warning W3030 because its schema does not know `Runtime: custom` yet)
- Serverless Framework 3.40 `package`: the `resources.extensions` override produces `Runtime: custom` and `RuntimeConfig` (v4 adds the esbuild build)
- Logger tests with `node --test`
- Not tested: Docker image build and deployment to AWS
