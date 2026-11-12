# AWS Emulator: integration tests for a Lambda handler

Example for the article [“AWS Emulator: test serverless code locally”](https://sascha-ms.de/en/aws-emulator-test-serverless-locally) (German version: [„AWS Emulator: Serverless-Code lokal testen ohne AWS-Konto“](https://sascha-ms.de/2026/2714-aws-emulator-lokal-testen)).

A fictional bike rental: a Lambda handler stores reservations in DynamoDB (with a condition against double bookings) and sends an event to SQS. Vitest runs integration tests against the local [AWS Emulator](https://github.com/aws/aws-emulator) – no AWS account needed.

## Files

| File | Purpose |
|---|---|
| `src/reservation.ts` | Lambda handler (no emulator-specific code) |
| `test/global-setup.ts` | Safety net: aborts unless STS answers with the emulator account `000000000000` |
| `test/reservation.int.test.ts` | Integration tests: booking, double booking, invalid input |
| `scripts/emulator-env.sh` | Points the shell (CLI and SDKs) at the emulator |
| `scripts/wait-for-emulator.sh` | Waits for the health route |
| `docker/Dockerfile` | Emulator image for macOS/Windows (from the AWS Emulator user guide) |
| `ci/github-actions.yml` | Example workflow – copy to `.github/workflows/` in your project |
| `serverless.yml` | Deploys the same handler to AWS (Serverless Framework v4) |

## Run

```bash
# Terminal 1: start the emulator (Linux package or Docker, see article)
aws-emulator --telemetry off

# Terminal 2
npm install
bash scripts/wait-for-emulator.sh
source scripts/emulator-env.sh
npm run test:int
```

## Verified with

Node.js 22, TypeScript 5.9.3, Vitest 3.2.7, AWS SDK for JavaScript v3.1167.0. `npm run typecheck` passes; the integration tests were executed against a moto server as stand-in (`EMULATOR_ACCOUNT_ID=123456789012`). Check the [AWS Emulator release notes](https://github.com/aws/aws-emulator/releases) for the fidelity of DynamoDB and SQS in your release.
