// lib/club-jobs-stack.ts
import { Duration, Stack, type StackProps, CfnOutput } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';

export class ClubJobsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const dlq = new sqs.Queue(this, 'ClubJobsDlq', {
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
    });

    // A plain standard queue: fair queues kick in via the MessageGroupId
    const queue = new sqs.Queue(this, 'ClubJobsQueue', {
      visibilityTimeout: Duration.seconds(180), // at least 6 x the Lambda timeout
      deadLetterQueue: { queue: dlq, maxReceiveCount: 5 },
      enforceSSL: true,
    });

    const logGroup = new logs.LogGroup(this, 'WorkerLogs', {
      retention: logs.RetentionDays.TWO_WEEKS,
    });

    const worker = new NodejsFunction(this, 'ClubJobWorker', {
      entry: 'src/worker.ts',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(30),
      logGroup,
    });

    // 20 concurrent environments x batch 10 = up to 200 messages in flight.
    // Enough for a noisy club with more than 10 % and at least 30 messages to stand out.
    worker.addEventSource(new SqsEventSource(queue, {
      batchSize: 10,
      maxConcurrency: 20,
      reportBatchItemFailures: true,
    }));

    // Alarm 1: how old is the oldest message of the quiet clubs?
    new cloudwatch.Alarm(this, 'QuietTenantsWaitingAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/SQS',
        metricName: 'ApproximateAgeOfOldestMessageInQuietGroups',
        dimensionsMap: { QueueName: queue.queueName },
        statistic: 'Maximum',
        period: Duration.minutes(1),
      }),
      threshold: 120,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Even quiet clubs wait more than 2 minutes – the workers are no longer enough',
    });

    // Alarm 2: are there clubs that stay noisy?
    new cloudwatch.Alarm(this, 'NoisyTenantsAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/SQS',
        metricName: 'ApproximateNumberOfNoisyGroups',
        dimensionsMap: { QueueName: queue.queueName },
        statistic: 'Maximum',
        period: Duration.minutes(5),
      }),
      threshold: 0,
      evaluationPeriods: 6,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'At least one club has been noisy for 30 minutes',
    });

    // Which clubs cause the most load? Top N from the structured logs
    new cloudwatch.CfnInsightRule(this, 'TopClubsRule', {
      ruleName: `${this.stackName}-top-clubs`,
      ruleState: 'ENABLED',
      ruleBody: JSON.stringify({
        Schema: { Name: 'CloudWatchLogRule', Version: 1 },
        LogGroupNames: [logGroup.logGroupName],
        LogFormat: 'JSON',
        Contribution: {
          Keys: ['$.clubId'],
          Filters: [{ Match: '$.msg', In: ['job-processed'] }],
        },
        AggregateOn: 'Count',
      }),
    });

    new CfnOutput(this, 'QueueUrl', { value: queue.queueUrl });
  }
}
