# API Gateway JWT authorizer for REST APIs with CDK

Example code for the article
[API Gateway JWT Authorizer for REST APIs with CDK](https://sascha-ms.de/en/api-gateway-jwt-authorizer-rest-api)
(German version: [API Gateway JWT Authorizer für REST APIs mit CDK](https://sascha-ms.de/2026/3542-api-gateway-jwt-authorizer)).

A fictional bike rental API: a station display board may only read bikes (`bikes:read`),
a booking app may also create rentals (`rentals:write`). Both get tokens from a Cognito
user pool via the OAuth 2.0 client credentials flow. API Gateway validates the tokens with
the native JWT authorizer for REST APIs, no Lambda authorizer involved.

## Files

| File | Purpose |
| --- | --- |
| `bin/app.ts` | CDK app entry point |
| `lib/bike-rental-api-stack.ts` | Cognito user pool, REST API, JWT authorizer (via escape hatches), methods with scopes |
| `src/claims.ts` | Helpers to read claims, scopes and the caller |
| `src/list-bikes.ts` | `GET /bikes` handler |
| `src/create-rental.ts` | `POST /rentals` handler with a second scope check |
| `scripts/get-token.ts` | Fetches an access token via client credentials |
| `test/claims.test.ts` | Unit tests with the Node.js test runner |

## Run

```bash
npm install
npm run typecheck
npm test
npx cdk synth
npx cdk deploy --outputs-file outputs.json
```

Optional second issuer (e.g. Okta, Auth0, Entra ID):

```bash
npx cdk deploy -c extraIssuer=https://your-tenant.eu.auth0.com/ -c extraAudience=https://api.bike-rental.example
```

See the article for the token and `curl` test commands. Clean up with `npx cdk destroy`.

## Notes

- aws-cdk-lib 2.277.0 does not know `JwtConfiguration` yet, so the stack uses `addPropertyOverride`.
  `cdk synth` shows a schema warning ("Additional properties are not allowed") until CDK is updated.
- Scopes are set as an override and added to the deployment's logical ID, so a scope change triggers a new deployment.

Tested with Node.js 22, TypeScript 7.0, aws-cdk-lib 2.277.0, aws-cdk CLI 2.1148.1.
