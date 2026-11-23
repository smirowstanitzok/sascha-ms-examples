# Rotate a webhook secret without downtime

Example code for the article **[Rotate a webhook secret without downtime](https://sascha-ms.de/en/rotate-webhook-secret)** (German original: [Webhook-Secret rotieren ohne Ausfall](https://sascha-ms.de/2026/3938-webhook-secret-rotieren)).

A fictional bike rental sends and receives webhooks signed according to the [Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks) spec. The signing secret lives in one SSM Parameter Store `SecureString`; the labels `current` and `previous` mark the active versions. During a rotation the sender signs with both secrets and the receiver accepts both. An hourly job removes `previous` once the overlap window has passed.

## Files

| File | Purpose |
| --- | --- |
| `src/signature.ts` | Sign and verify with several secrets (no AWS dependency) |
| `src/keys.ts` | Load `current` / `previous` from Parameter Store with a short cache |
| `src/receiver.ts` | Lambda function URL that verifies incoming webhooks |
| `src/sender.ts` | Lambda that sends a signed webhook to a partner |
| `src/rotation.ts` | `rotate` (new version + move labels) and `retire` (remove `previous` after the window) |
| `test/signature.test.ts` | Tests with the built-in Node.js test runner |
| `serverless.yml` | Serverless Framework v4 service |

## Run

```bash
npm install
npx tsc --noEmit
node --test test/*.test.ts      # Node.js 22.18+; older 22.x: add --experimental-strip-types
serverless deploy
serverless invoke -f rotate                                  # first secret / sender rotation
serverless invoke -f rotate --data '{"secret":"whsec_..."}'  # receiver: store the provider's secret
```

Tested with Node.js 22.23, TypeScript 5.9 and @aws-sdk/client-ssm 3.x. The `TARGET_URL` in `serverless.yml` is a placeholder.
