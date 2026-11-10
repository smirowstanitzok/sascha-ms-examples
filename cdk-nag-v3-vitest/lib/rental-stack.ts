// lib/rental-stack.ts
import { Duration, RemovalPolicy, Stack, Validations, type StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';

export class RentalStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Target bucket for the receipt bucket's access logs
    const accessLogs = new s3.Bucket(this, 'AccessLogBucket', {
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });
    Validations.of(accessLogs).acknowledge({
      id: 'AwsSolutions-S1',
      reason: 'Target bucket for access logs; logging the logs adds no value.',
    });

    const receipts = new s3.Bucket(this, 'ReceiptBucket', {
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      serverAccessLogsBucket: accessLogs,
      serverAccessLogsPrefix: 'receipts/',
    });

    // Bookings flow through a queue with a dead-letter queue
    const dlq = new sqs.Queue(this, 'BookingDlq', {
      enforceSSL: true,
      retentionPeriod: Duration.days(14),
    });
    Validations.of(dlq).acknowledge({
      id: 'Serverless-SQSRedrivePolicy',
      reason: 'The DLQ is the final stop; an alarm on its depth replaces another redrive level.',
    });
    const queue = new sqs.Queue(this, 'BookingQueue', {
      enforceSSL: true,
      visibilityTimeout: Duration.seconds(60),
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
    });

    const table = new dynamodb.Table(this, 'BookingTable', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const fn = new lambda.Function(this, 'BookingHandler', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => {};'),
      timeout: Duration.seconds(10),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
    });
    fn.addEventSource(new SqsEventSource(queue));
    table.grantWriteData(fn);
    // Only PutObject below receipts/ instead of grantPut with s3:Abort* and friends
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: [receipts.arnForObjects('receipts/*')],
    }));

    // Acknowledgments apply to the function and everything below it (role, policy, mapping)
    Validations.of(fn).acknowledge(
      {
        id: 'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
        reason: 'The AWS basic role only allows writing its own CloudWatch logs.',
      },
      {
        id: `AwsSolutions-IAM5[Resource::<${this.getLogicalId(receipts.node.defaultChild as s3.CfnBucket)}.Arn>/receipts/*]`,
        reason: 'Receipts are stored per booking as receipts/<bookingId>.pdf; the prefix limits access.',
      },
      {
        id: 'AwsSolutions-IAM5[Resource::*]',
        reason: 'X-Ray only: PutTraceSegments and PutTelemetryRecords do not support resource ARNs.',
      },
      {
        id: 'Serverless-LambdaDLQ',
        reason: 'The function is only invoked synchronously by SQS; failed attempts end up in the queue DLQ.',
      },
      {
        id: 'Serverless-LambdaEventSourceMappingDestination',
        reason: 'SQS mappings have no on-failure destination; the queue redrive policy covers this.',
      },
    );
  }
}
