// infra/lib/ticket-queue-stack.ts
import { Duration, Fn, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cr from 'aws-cdk-lib/custom-resources';
import type { Construct } from 'constructs';
import * as path from 'node:path';

export class TicketQueueStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1) Queues only work on On-demand streams.
    const stream = new kinesis.Stream(this, 'TicketSales', {
      streamName: 'ticket-sales',
      streamMode: kinesis.StreamMode.ON_DEMAND,
      encryption: kinesis.StreamEncryption.MANAGED,
      // DeleteStream fails while a queue is still being deleted, so keep the stream.
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // 2) CloudFormation has no queue resource yet: create it via SDK call.
    const queueName = 'ticket-mailer';
    const queue = new cr.AwsCustomResource(this, 'TicketMailerQueue', {
      installLatestAwsSdk: true, // the queue APIs are newer than the SDK in the Lambda runtime
      onCreate: {
        service: 'Kinesis',
        action: 'CreateQueue',
        parameters: {
          QueueName: queueName,
          StreamConfigurationList: [{ StreamARN: stream.streamArn, StartingPosition: { Type: 'LATEST' } }],
          QueueAttributes: {
            VisibilityTimeoutSeconds: 60,
            DeadLetterConfiguration: { TargetType: 'BUILT_IN', MaxReceiveCount: 5 },
          },
        },
        physicalResourceId: cr.PhysicalResourceId.fromResponse('QueueDescription.QueueARN'),
        outputPaths: ['QueueDescription.QueueARN'],
      },
      onDelete: {
        service: 'Kinesis',
        action: 'DeleteQueue',
        parameters: { QueueARN: new cr.PhysicalResourceIdReference() },
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['kinesis:CreateQueue', 'kinesis:DeleteQueue'],
          resources: [`arn:${this.partition}:kinesis:${this.region}:${this.account}:queue/*`],
        }),
        new iam.PolicyStatement({ actions: ['kinesis:AssociateStreamsWithQueue'], resources: [stream.streamArn] }),
      ]),
    });
    const queueArn = queue.getResponseField('QueueDescription.QueueARN');
    // The metric dimension QueueId is the generated ID at the end of the ARN.
    const queueId = Fn.select(1, Fn.split('queue/', queueArn));

    // 3) Idempotency table with TTL.
    const table = new dynamodb.TableV2(this, 'MailIdempotency', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // 4) Worker on Fargate. Public subnets without NAT keep the example cheap.
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ name: 'public', subnetType: ec2.SubnetType.PUBLIC }],
    });
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'WorkerTask', {
      cpu: 256,
      memoryLimitMiB: 512,
      runtimePlatform: { cpuArchitecture: ecs.CpuArchitecture.ARM64 },
    });
    taskDefinition.addContainer('worker', {
      image: ecs.ContainerImage.fromAsset(path.join(import.meta.dirname, '..', '..')),
      environment: { QUEUE_ARN: queueArn, IDEMPOTENCY_TABLE: table.tableName },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'ticket-mailer', logRetention: logs.RetentionDays.ONE_WEEK }),
      stopTimeout: Duration.seconds(30), // enough for the last long poll (max. 20 s)
    });
    taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['kinesis:ReceiveQueueRecords', 'kinesis:AcknowledgeQueueRecords', 'kinesis:UpdateQueueRecordsVisibility'],
        resources: [queueArn],
      }),
    );
    stream.encryptionKey?.grantDecrypt(taskDefinition.taskRole); // only relevant with a customer managed key
    table.grantReadWriteData(taskDefinition.taskRole);

    const service = new ecs.FargateService(this, 'Worker', {
      cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      minHealthyPercent: 100,
      circuitBreaker: { rollback: true },
    });

    // 5) Scale on the backlog, independent of the shard count.
    const metric = (metricName: string) =>
      new cloudwatch.Metric({
        namespace: 'AWS/Kinesis',
        metricName,
        dimensionsMap: { QueueId: queueId, QueueName: queueName },
        statistic: 'Average',
        period: Duration.minutes(1),
      });

    service.autoScaleTaskCount({ minCapacity: 1, maxCapacity: 10 }).scaleOnMetric('Backlog', {
      metric: metric('VisibleQueueRecords'),
      scalingSteps: [
        { upper: 100, change: -1 },
        { lower: 1_000, change: +2 },
        { lower: 10_000, change: +4 },
      ],
      cooldown: Duration.minutes(2),
    });

    // 6) Alarm as soon as records end up as dead letters.
    new cloudwatch.Alarm(this, 'DeadLetters', {
      metric: metric('VisibleDeadLetterQueueRecords'),
      threshold: 0,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Ticket mails that failed five times are waiting in the dead-letter state',
    });
  }
}
