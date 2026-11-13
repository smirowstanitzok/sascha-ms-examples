# Cognito token exchange: let AI agents act safely

Example code for the article
[Cognito token exchange: let AI agents act safely](https://sascha-ms.de/en/cognito-token-exchange-ai-agents)
(German version: [Cognito Token Exchange: KI-Agenten sicher delegieren](https://sascha-ms.de/2026/2821-cognito-token-exchange-ki-agenten)).

An AI agent of a fictional bookstore reads a customer's orders on her behalf. The agent Lambda exchanges the customer's access token at the Cognito token endpoint (OAuth 2.0 token exchange, RFC 8693, delegation with an actor token). The new token is only valid for the orders API (`aud: bestellungen`), can only read and carries an `act` claim. The orders API checks audience and scope with an API Gateway JWT authorizer and evaluates the `act` claim in a small policy function.

## Files

| File | Purpose |
| --- | --- |
| `lib/token-exchange-stack.ts` | User pool (Essentials), domain, resource servers, web and agent app clients, two HTTP APIs, three functions |
| `src/token-client.ts` | Token endpoint client: client credentials and token exchange via `fetch` |
| `src/agent.ts` | Agent Lambda: actor token (cached), token exchange, call to the orders API |
| `src/orders-api.ts` | Orders API: reads claims, applies the policy, writes an audit log line |
| `src/policy.ts` | Decides what a call may do, depending on scope and `act` claim |
| `src/pre-token.ts` | Pre token generation trigger: opt-in via `custom:ki_freigabe` |
| `src/client-update.ts` | Builds a complete `UpdateUserPoolClient` request (adds one auth flow) |
| `scripts/enable-token-exchange.ts` | Enables `ALLOW_TOKEN_EXCHANGE_DELEGATION` on the agent client after deployment |
| `test/*.test.ts` | Vitest tests for policy, token client, client update and CDK template |

## Run

```bash
npm install
npx tsc --noEmit
npx vitest run

npx cdk deploy
npx tsx scripts/enable-token-exchange.ts <UserPoolId> <AgentClientId>
```

Why the script? As of November 13, 2026, the CloudFormation schema bundled with aws-cdk-lib 2.276.0 doesn't know `ALLOW_TOKEN_EXCHANGE_DELEGATION` yet (warning W3030), and the AWS SDKs don't have a `GetDerivedToken` command yet. The example therefore uses the token endpoint directly. Run the script again after every deployment that changes the agent client.

The stack creates real resources (Cognito on the Essentials plan, Lambda, API Gateway). Check the costs and remove everything afterwards with `npx cdk destroy`.

## Tested with

- aws-cdk-lib 2.276.0, aws-cdk 2.1148.1
- @aws-sdk/client-cognito-identity-provider 3.1168.0
- TypeScript 7.0.2, Vitest 5.1.0, tsx 4.23.15
- Node.js 24 (Lambda runtime), Node.js 22 locally
