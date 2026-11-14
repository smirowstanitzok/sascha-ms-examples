// lib/primary-account-stack.ts
import { CfnOutput, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';

export interface PrimaryAccountStackProps extends StackProps {
  /** ARN of the replica secret in the other account (from step 5) */
  readonly replicaSecretArn?: string;
  /** ARN of the KMS key in the replica account (from step 5) */
  readonly replicaKeyArn?: string;
}

export class PrimaryAccountStack extends Stack {
  constructor(scope: Construct, id: string, props: PrimaryAccountStackProps) {
    super(scope, id, props);

    // Customer managed key: required when a replication role has to decrypt
    const primaryKey = new kms.Key(this, 'PrimaryKey', {
      alias: 'alias/bikerental-secrets-primary',
      description: 'Encrypts the centrally managed secrets of the bike rental',
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // The primary secret. Set the real API key afterwards with put-secret-value.
    const paymentSecret = new secretsmanager.Secret(this, 'PaymentProviderApiKey', {
      secretName: 'bikerental/payment-provider-api-key',
      description: 'API key of the payment provider, maintained by the platform team',
      encryptionKey: primaryKey,
      generateSecretString: { passwordLength: 40, excludePunctuation: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    new CfnOutput(this, 'PrimarySecretArn', { value: paymentSecret.secretArn });

    // The role is only created once the replica secret and replica key are known
    if (!props.replicaSecretArn || !props.replicaKeyArn) {
      return;
    }

    const replicationRole = new iam.Role(this, 'ReplicationRole', {
      roleName: 'bikerental-secret-replication',
      description: 'Assumed by Secrets Manager for cross-account replication',
      // Protection against the confused deputy problem: only for exactly this secret
      assumedBy: new iam.ServicePrincipal('secretsmanager.amazonaws.com').withConditions({
        StringEquals: { 'aws:SourceAccount': this.account },
        ArnEquals: { 'aws:SourceArn': paymentSecret.secretArn },
      }),
    });

    // 1. Decrypt the data key of the primary secret
    replicationRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'DecryptPrimary',
        actions: ['kms:Decrypt'],
        resources: [primaryKey.keyArn],
        conditions: {
          StringEquals: { 'kms:EncryptionContext:SecretARN': paymentSecret.secretArn },
        },
      }),
    );

    // 2. Re-encrypt for the replica in the other account
    replicationRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'EncryptReplica',
        actions: ['kms:Encrypt'],
        resources: [props.replicaKeyArn],
        conditions: {
          StringEquals: { 'kms:EncryptionContext:SecretARN': props.replicaSecretArn },
        },
      }),
    );

    new CfnOutput(this, 'ReplicationRoleArn', { value: replicationRole.roleArn });
  }
}
