# Secure an MCP server with Cognito: CIMD instead of DCR

Example code for the article:

- English: https://sascha-ms.de/en/mcp-server-cognito-cimd
- German: https://sascha-ms.de/2026/3807-mcp-server-mit-cognito-cimd

A minimal MCP server on AWS Lambda (HTTP API) that uses Amazon Cognito as OAuth authorization server with
client ID metadata documents (CIMD). The server publishes protected resource metadata (RFC 9728), answers
with `401` + `WWW-Authenticate`, and verifies access tokens including audience (resource binding, RFC 8707) and scope.

## Files

| File | Purpose |
| --- | --- |
| `serverless.yml` | Lambda, HTTP API, Cognito user pool (Essentials), domain, resource server, base app client |
| `src/auth.ts` | Protected resource metadata, `WWW-Authenticate` challenge, JWT verification with `aws-jwt-verify` |
| `src/handler.ts` | Lambda handler and routing |
| `src/mcp.ts` | Deliberately minimal JSON-RPC layer with one tool (`search_books`) |
| `test/handler.test.ts` | Tests with the Node.js test runner, no AWS access needed |
| `client-metadata.json` | Example client ID metadata document of a fictional MCP client |

## Run the tests

```bash
npm install
npx tsc --noEmit
npm test
```

## Deploy

```bash
serverless deploy
serverless info --verbose

aws cognito-idp create-cimd-policy \
  --user-pool-id <UserPoolId> \
  --client-id <CimdBaseClientId> \
  --policy-name ai-assistants \
  --url-patterns https://assistant.example.com/oauth/client-metadata.json \
  --cache-duration 86400
```

Tested with Node.js 22, TypeScript 5.9, aws-jwt-verify 5.2 and Serverless Framework v4.
The JSON-RPC layer is intentionally minimal; use the official MCP SDK for production servers.
