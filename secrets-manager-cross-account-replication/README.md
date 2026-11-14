# Secrets Manager cross-account replication

Example code for the article **Secrets Manager Cross-Account Replication: Setup Guide**

- English: https://sascha-ms.de/en/secrets-manager-cross-account-replication
- German: https://sascha-ms.de/2026/2992-secrets-manager-cross-account-replikation

A fictional bike rental keeps the API key of its payment provider in a platform account (primary) and replicates it into the booking account (replica). The booking Lambda only reads the local replica.

## Files

| File | Purpose |
| --- | --- |
| `bin/app.ts` | CDK app with one stack per account |
| `lib/primary-account-stack.ts` | Customer managed KMS key, primary secret and replication role |
| `lib/replica-account-stack.ts` | Replica KMS key with cross-account `kms:Encrypt` grant and the booking Lambda |
| `src/booking-handler.ts` | Lambda handler that reads the replica with a short in-memory cache |
| `scripts/wait-for-replication.ts` | Polls `DescribeSecret` until the replica is `InSync` |

## Run

```bash
npm install
npm run typecheck
npx cdk synth -c primaryAccount=111111111111 -c replicaAccount=222222222222
```

Deployment order (see the article for details):

1. Deploy `BikeRentalSecretsPrimary` in the primary account.
2. Deploy `BikeRentalBookingReplica` in the replica account.
3. Create the replica secret with `aws secretsmanager create-secret --cross-account-primary-arn ... --kms-key-id ...`.
4. Redeploy both stacks with `-c replicaSecretArn=...` (and `-c replicaKeyArn=...` for the primary stack).
5. Run `aws secretsmanager associate-cross-account-replica` in the primary account.
6. `AWS_PROFILE=platform npx tsx scripts/wait-for-replication.ts <primary-secret-arn>`

CloudFormation has no property for cross-account replicas yet, so steps 3 and 5 use the AWS CLI.

## Tested with

- Node.js 22
- TypeScript 7.0.2
- aws-cdk-lib 2.277.0, aws-cdk 2.1148.1
- @aws-sdk/client-secrets-manager 3.1169.0
