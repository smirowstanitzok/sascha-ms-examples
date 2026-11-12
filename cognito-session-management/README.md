# Cognito session management: sign out devices with Lambda

Example code for the article
[Cognito session management: sign out devices with Lambda](https://sascha-ms.de/en/cognito-session-management-lambda)
(German version: [Cognito Session Management: Geräte abmelden mit Lambda](https://sascha-ms.de/2026/2799-cognito-session-management-lambda)).

A “My devices” API for a fictional bike rental: an HTTP API with a Cognito JWT authorizer, two Lambda functions that list and revoke the caller's sessions with `ListUserSessions` / `RevokeUserSession`, and a support function that uses `AdminListUserSessions` / `AdminRevokeUserSession`.

## Files

| File | Purpose |
| --- | --- |
| `serverless.yml` | User pool (Essentials), app client, HTTP API with JWT authorizer, three functions |
| `src/sessions.ts` | Maps Cognito sessions to a display model, masks IP addresses |
| `src/my-sessions.ts` | `GET /sessions` and `DELETE /sessions/{id}` |
| `src/support.ts` | Support function: list and revoke a user's sessions |
| `scripts/enable-sessions.sh` | Turns on session tracking and sets limits via the AWS CLI |
| `test/sessions.test.ts` | Vitest tests with `aws-sdk-client-mock` |

## Run

```bash
npm install
npx tsc --noEmit
npx vitest run

serverless deploy
./scripts/enable-sessions.sh <user-pool-id> <app-client-id>
```

Session management requires a user pool on the Essentials or Plus feature plan and a recent AWS CLI.

## Tested with

- @aws-sdk/client-cognito-identity-provider 3.1167.0
- TypeScript 7.0.2, Vitest 5.1.0, aws-sdk-client-mock 4.1.0
- Serverless Framework v4 (template also packaged with osls 3)
- Node.js 24
