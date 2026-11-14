// lib/replica-account-stack.ts
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import type { Construct } from 'constructs';

export interface ReplicaAccountStackProps extends StackProps {
  /** Account that owns the primary secret */
  readonly primaryAccountId: string;
  /** ARN of the replica secret (from step 5) */
  readonly replicaSecretArn?: string;
}

export class ReplicaAccountStack extends Stack {
  constructor(scope: Construct, id: string, props: ReplicaAccountStackProps) {
    super(scope, id, props);

    // The key belongs to the replica account, not to the platform team
    const replicaKey = new kms.Key(this, 'ReplicaKey', {
      alias: 'alias/bikerental-booking-replica',
      description: 'Encrypts the replica of the payment provider key',
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    new CfnOutput(this, 'ReplicaKeyArn', { value: replicaKey.keyArn });

    if (!props.replicaSecretArn) {
      return;
    }

    // The primary account may use this key only to encrypt exactly this replica
    replicaKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCrossAccountReplication',
        principals: [new iam.AccountPrincipal(props.primaryAccountId)],
        actions: ['kms:Encrypt'],
        resources: ['*'],
        conditions: {
          StringEquals: { 'kms:EncryptionContext:SecretARN': props.replicaSecretArn },
        },
      }),
    );

    // The booking Lambda only reads locally in its own account
    const bookingFn = new NodejsFunction(this, 'BookingFunction', {
      entry: 'src/booking-handler.ts',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: {
        PAYMENT_SECRET_ARN: props.replicaSecretArn,
        SECRET_CACHE_SECONDS: '300',
      },
    });

    bookingFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [props.replicaSecretArn],
      }),
    );
    replicaKey.grantDecrypt(bookingFn);

    new CfnOutput(this, 'BookingFunctionName', { value: bookingFn.functionName });
  }
}
