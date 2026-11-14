// bin/app.ts
import { App } from 'aws-cdk-lib';
import { PrimaryAccountStack } from '../lib/primary-account-stack.js';
import { ReplicaAccountStack } from '../lib/replica-account-stack.js';

const app = new App();

// Account IDs and region come from cdk.json or via -c on the command line
const region = app.node.tryGetContext('region') ?? 'eu-central-1';
const primaryAccount = app.node.tryGetContext('primaryAccount') ?? '111111111111';
const replicaAccount = app.node.tryGetContext('replicaAccount') ?? '222222222222';

// Only known after the replica secret has been created (step 4)
const replicaSecretArn: string | undefined = app.node.tryGetContext('replicaSecretArn');
const replicaKeyArn: string | undefined = app.node.tryGetContext('replicaKeyArn');

new PrimaryAccountStack(app, 'BikeRentalSecretsPrimary', {
  env: { account: primaryAccount, region },
  replicaSecretArn,
  replicaKeyArn,
});

new ReplicaAccountStack(app, 'BikeRentalBookingReplica', {
  env: { account: replicaAccount, region },
  primaryAccountId: primaryAccount,
  replicaSecretArn,
});
