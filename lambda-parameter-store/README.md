# Parameter Store in Lambda: loading config the right way

Example code for the article:

- English: https://sascha-ms.de/en/parameter-store-lambda-configuration
- German: https://sascha-ms.de/2026/1686-parameter-store-lambda

A small HTTP API for a fictional bike rental. It reads an hourly price, a pause switch and a payment key (SecureString) from AWS Systems Manager Parameter Store, caches them with the Powertools Parameters utility and is deployed with the Serverless Framework v4.

## Files

| File | Purpose |
| --- | --- |
| `serverless.yml` | Function, HTTP API, IAM permissions, deploy-time `${ssm:}` variable |
| `scripts/create-parameters.sh` | Creates the example parameters for one stage |
| `src/config.ts` | Loads and validates the configuration with `getParametersByName` |
| `src/pricing.ts` | Pure pricing logic |
| `src/handler.ts` | Lambda handler for `GET /quote?hours=3` |
| `src/extension.ts` | Alternative: read parameters via the AWS Parameters and Secrets Lambda Extension |
| `test/pricing.test.ts` | Local tests, no AWS access needed |

## Run it

```bash
npm install
npm test
npx tsc --noEmit

# needs AWS credentials
bash scripts/create-parameters.sh dev
serverless deploy --stage dev
curl "https://<api-id>.execute-api.eu-central-1.amazonaws.com/quote?hours=2.5"
```

Clean up with `serverless remove --stage dev` and delete the parameters below `/bike-rental/dev`.

## Tested with

Node.js 22, TypeScript 5.9, @aws-lambda-powertools/parameters 2.36, tsx 4. `npm test` and `tsc --noEmit` pass; the deployment itself was not run as part of writing the article.
