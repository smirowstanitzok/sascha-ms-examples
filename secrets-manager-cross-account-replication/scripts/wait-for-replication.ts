// scripts/wait-for-replication.ts
import { DescribeSecretCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const secretId = process.argv[2];
const maxAttempts = Number(process.argv[3] ?? '24');
const client = new SecretsManagerClient({});

if (!secretId) {
  console.error('Usage: npx tsx scripts/wait-for-replication.ts <primary-secret-arn> [attempts]');
  process.exit(2);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const secret = await client.send(new DescribeSecretCommand({ SecretId: secretId }));
  const replica = secret.CrossAccountReplicas?.[0];

  if (!replica) {
    console.error('No cross-account replica associated.');
    process.exit(1);
  }

  console.log(`Attempt ${attempt}: ${replica.ReplicationStatus} -> ${replica.ReplicaSecretARN}`);

  if (replica.ReplicationStatus === 'InSync') {
    process.exit(0);
  }
  if (replica.ReplicationStatus === 'Failed' || replica.ReplicationStatus === 'Detached') {
    console.error(`Aborting: ${replica.StatusMessage ?? 'no details'}`);
    process.exit(1);
  }
  await sleep(5000);
}

console.error('Time limit reached, replica is not InSync yet.');
process.exit(1);
