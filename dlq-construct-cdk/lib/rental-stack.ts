// lib/rental-stack.ts
import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { QueueWithDlq } from './queue-with-dlq.js';

export class RentalReturnsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const timeout = Duration.seconds(20);
    const consumer = new NodejsFunction(this, 'ReturnConsumer', {
      entry: 'src/return-consumer.ts',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      timeout,
      memorySize: 256,
      logGroup: new logs.LogGroup(this, 'ReturnConsumerLogs', {
        retention: logs.RetentionDays.TWO_WEEKS,
      }),
      environment: {
        // Fictional billing API of the bike rental
        BILLING_URL: 'https://billing.example.com/rentals',
      },
    });

    const alarmTopic = new sns.Topic(this, 'Alarms');

    const returns = new QueueWithDlq(this, 'RentalReturns', {
      consumer,
      consumerTimeout: timeout,
      maxReceiveCount: 5,
      alarmTopic,
      autoRedrive: {
        schedule: scheduler.ScheduleExpression.rate(Duration.hours(1)),
        maxMessagesPerSecond: 5,
      },
    });

    new CfnOutput(this, 'QueueUrl', { value: returns.queue.queueUrl });
    new CfnOutput(this, 'DlqArn', { value: returns.deadLetterQueue.queueArn });
    new CfnOutput(this, 'ParkingQueueUrl', { value: returns.parkingQueue.queueUrl });
  }
}
