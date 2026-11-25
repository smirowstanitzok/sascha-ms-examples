# AWS GetScopedCredentials: least privilege for AI agents

Example code for the article **[AWS GetScopedCredentials: Least Privilege for AI Agents](https://sascha-ms.de/en/aws-getscopedcredentials-ai-agents)** ([German version](https://sascha-ms.de/2026/3994-aws-getscopedcredentials-ki-agenten)).

A fictional bike rental platform ("Pedalwerk") with an AI assistant on AWS Lambda. Every request gets credentials from STS `GetScopedCredentials` that only allow access to the S3 prefix of the requesting shop. The agent's tools only ever use these scoped-down credentials.

## Files

| File | Purpose |
| --- | --- |
| `src/scope-policy.ts` | Builds scope-down policies (per shop, read-only, deny list) and checks the 2,048-character limit |
| `src/credential-broker.ts` | Calls `GetScopedCredentials`, caches credentials, retries without `DurationSeconds` if the session is too short |
| `src/tools.ts` | S3 tools for the agent, using only the scoped-down credentials |
| `src/agent.ts` | Minimal agent loop with the Bedrock Converse API and tool use |
| `src/handler.ts` | HTTP API Lambda handler: reads the shop ID from the JWT and starts the agent |
| `lib/assistant-stack.ts`, `bin/app.ts` | AWS CDK stack: S3 bucket, Lambda function, HTTP API with JWT authorizer |
| `test/*.test.ts` | Unit tests with `node:test`, no AWS account needed |

## Run

Requires Node.js 22.18 or newer (type stripping).

```bash
npm install
npm run typecheck
npm test
npx cdk synth
```

Deploy (needs a bootstrapped CDK environment, a JWT issuer that sets the `custom:shop_id` claim and a Bedrock model with tool use):

```bash
npx cdk deploy \
  --parameters JwtIssuer=https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_EXAMPLE \
  --parameters JwtAudience=your-client-id \
  --parameters ModelId=your-model-or-inference-profile-id
```

## Tested with

- Node.js 22.23.5, TypeScript 7.0.2
- @aws-sdk/client-sts 3.1177.0, aws-cdk-lib 2.278.0, aws-cdk 2.1149.0
- `tsc --noEmit`, `node --test` (8 tests) and `cdk synth` passed on 2026-11-25. Not deployed against production systems.
