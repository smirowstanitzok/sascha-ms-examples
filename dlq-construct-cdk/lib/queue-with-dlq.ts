// lib/queue-with-dlq.ts
import { Duration } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as targets from 'aws-cdk-lib/aws-scheduler-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface AutoRedriveOptions {
  /** When the redrive starts, e.g. ScheduleExpression.rate(Duration.hours(1)) */
  readonly schedule: scheduler.ScheduleExpression;
  /** Throttling for the redrive (1 to 500 messages per second) */
  readonly maxMessagesPerSecond?: number;
}

export interface QueueWithDlqProps {
  /** The Lambda function that processes the queue */
  readonly consumer: lambda.Function;
  /** Function timeout, used to calculate the visibility timeout */
  readonly consumerTimeout: Duration;
  /** Attempts before a message moves to the DLQ (default: 5) */
  readonly maxReceiveCount?: number;
  /** Age of the oldest message that triggers the backlog alarm (default: 15 minutes) */
  readonly maxMessageAge?: Duration;
  /** Optional: SNS topic for all alarms */
  readonly alarmTopic?: sns.ITopic;
  /** Optional: automatic redrive, meant for transient errors only */
  readonly autoRedrive?: AutoRedriveOptions;
}

export class QueueWithDlq extends Construct {
  public readonly queue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly parkingQueue: sqs.Queue;
  public readonly alarms: cloudwatch.Alarm[] = [];

  constructor(scope: Construct, id: string, props: QueueWithDlqProps) {
    super(scope, id);

    const maxReceiveCount = props.maxReceiveCount ?? 5;
    const rate = props.autoRedrive?.maxMessagesPerSecond ?? 10;
    if (maxReceiveCount < 2) {
      throw new Error('maxReceiveCount must be at least 2, otherwise a single timeout sends a message to the DLQ.');
    }
    if (rate < 1 || rate > 500) {
      throw new Error('maxMessagesPerSecond must be between 1 and 500.');
    }

    // DLQ: longest retention, because the age from the source queue carries over
    this.deadLetterQueue = new sqs.Queue(this, 'Dlq', {
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
    });

    // Parking spot for permanently broken messages: no redrive, analysis only
    this.parkingQueue = new sqs.Queue(this, 'Parking', {
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
    });

    this.queue = new sqs.Queue(this, 'Queue', {
      // Recommendation for Lambda: at least six times the function timeout
      visibilityTimeout: Duration.seconds(props.consumerTimeout.toSeconds() * 6),
      retentionPeriod: Duration.days(4),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      deadLetterQueue: { queue: this.deadLetterQueue, maxReceiveCount },
    });

    props.consumer.addEventSource(
      new SqsEventSource(this.queue, {
        batchSize: 10,
        reportBatchItemFailures: true,
      }),
    );
    this.parkingQueue.grantSendMessages(props.consumer);
    props.consumer.addEnvironment('PARKING_QUEUE_URL', this.parkingQueue.queueUrl);

    this.addAlarm('DlqNotEmpty', {
      metric: this.deadLetterQueue.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(1),
        statistic: 'Maximum',
      }),
      threshold: 1,
      alarmDescription: 'Messages in the DLQ: processing failed repeatedly.',
    }, props.alarmTopic);

    this.addAlarm('ParkingNotEmpty', {
      metric: this.parkingQueue.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(5),
        statistic: 'Maximum',
      }),
      threshold: 1,
      alarmDescription: 'Permanently broken messages parked: please take a look.',
    }, props.alarmTopic);

    this.addAlarm('QueueBacklog', {
      metric: this.queue.metricApproximateAgeOfOldestMessage({
        period: Duration.minutes(1),
        statistic: 'Maximum',
      }),
      threshold: (props.maxMessageAge ?? Duration.minutes(15)).toSeconds(),
      evaluationPeriods: 5,
      alarmDescription: 'The oldest message has been waiting too long: consumer too slow or failing.',
    }, props.alarmTopic);

    if (props.autoRedrive) {
      new scheduler.Schedule(this, 'AutoRedrive', {
        description: 'Moves the DLQ back to the source queue on a schedule',
        schedule: props.autoRedrive.schedule,
        target: new targets.Universal({
          service: 'sqs',
          action: 'startMessageMoveTask',
          // Without DestinationArn, messages go back to their source queue
          input: scheduler.ScheduleTargetInput.fromObject({
            SourceArn: this.deadLetterQueue.queueArn,
            MaxNumberOfMessagesPerSecond: rate,
          }),
          retryAttempts: 0,
          policyStatements: [
            new iam.PolicyStatement({
              actions: [
                'sqs:StartMessageMoveTask',
                'sqs:ReceiveMessage',
                'sqs:DeleteMessage',
                'sqs:GetQueueAttributes',
              ],
              resources: [this.deadLetterQueue.queueArn],
            }),
            new iam.PolicyStatement({
              actions: ['sqs:SendMessage'],
              resources: [this.queue.queueArn],
            }),
          ],
        }),
      });
    }
  }

  private addAlarm(
    id: string,
    props: Omit<cloudwatch.AlarmProps, 'evaluationPeriods'> & { evaluationPeriods?: number },
    topic?: sns.ITopic,
  ): void {
    const alarm = new cloudwatch.Alarm(this, id, {
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      ...props,
      evaluationPeriods: props.evaluationPeriods ?? 1,
    });
    if (topic) {
      alarm.addAlarmAction(new cwActions.SnsAction(topic));
      alarm.addOkAction(new cwActions.SnsAction(topic));
    }
    this.alarms.push(alarm);
  }
}
