# Testing the Serverless Framework with Vitest

Example code for the article **Testing the Serverless Framework with Vitest**:

- English: https://sascha-ms.de/en/testing-serverless-framework-vitest
- German: https://sascha-ms.de/2026/2460-serverless-framework-testen

A fictional bike rental service (`serverless.yml`) with an HTTP API, a DynamoDB table and an SQS queue with a dead-letter queue. A Vitest `globalSetup` runs `serverless package` for the `dev` and `prod` stages, and the tests check the generated CloudFormation templates. Nothing is deployed.

## Files

| File | Purpose |
| --- | --- |
| `serverless.yml` | Service definition with stage-specific `params` |
| `src/start-rental.ts` | Minimal Lambda handler |
| `test/package-stages.ts` | Vitest `globalSetup`: packages both stages into `.serverless-dev` and `.serverless-prod` |
| `test/template.ts` | Types and helpers for reading the templates |
| `test/infrastructure.test.ts` | 12 tests for runtime, backups, DLQ, log retention, IAM and stage differences |
| `vitest.config.ts` | Registers the `globalSetup` |

## Run

```bash
npm install
export AWS_ACCESS_KEY_ID=dummy AWS_SECRET_ACCESS_KEY=dummy
npm run typecheck

# Serverless Framework v4 (requires login or SERVERLESS_LICENSE_KEY)
npm test

# Without login: the open source fork osls
npm run test:osls
```

The first run writes a snapshot of the resource types to `test/__snapshots__`. The list differs slightly between v4 and osls, so create it with the same command your pipeline uses.

## Verified with

Node.js 22, osls 4.6.0, Vitest 5.1.0, TypeScript 5.9.3 (12 tests passing, November 2026). Serverless Framework v4.46.0 is the intended default but could not be run in the verification environment because it requires a login.
