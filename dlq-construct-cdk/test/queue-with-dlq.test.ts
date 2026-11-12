// test/queue-with-dlq.test.ts
import { App, Duration, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import { describe, expect, it } from 'vitest';
import { QueueWithDlq, type QueueWithDlqProps } from '../lib/queue-with-dlq.js';

function synth(extra: Partial<QueueWithDlqProps> = {}): Template {
  const stack = new Stack(new App(), 'TestStack');
  const consumer = new lambda.Function(stack, 'Fn', {
    runtime: lambda.Runtime.NODEJS_22_X,
    handler: 'index.handler',
    code: lambda.Code.fromInline('exports.handler = async () => ({ batchItemFailures: [] });'),
    timeout: Duration.seconds(20),
  });
  new QueueWithDlq(stack, 'Returns', { consumer, consumerTimeout: Duration.seconds(20), ...extra });
  return Template.fromStack(stack);
}

describe('QueueWithDlq', () => {
  it('sets visibility timeout and redrive policy', () => {
    synth().hasResourceProperties('AWS::SQS::Queue', {
      VisibilityTimeout: 120,
      RedrivePolicy: { maxReceiveCount: 5, deadLetterTargetArn: Match.anyValue() },
    });
  });

  it('keeps DLQ messages for 14 days', () => {
    const queues = synth().findResources('AWS::SQS::Queue', {
      Properties: { MessageRetentionPeriod: 1209600 },
    });
    expect(Object.keys(queues)).toHaveLength(2); // DLQ and parking queue
  });

  it('reports partial batch failures', () => {
    synth().hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      FunctionResponseTypes: ['ReportBatchItemFailures'],
    });
  });

  it('creates three alarms', () => {
    synth().resourceCountIs('AWS::CloudWatch::Alarm', 3);
  });

  it('creates no schedule without autoRedrive', () => {
    synth().resourceCountIs('AWS::Scheduler::Schedule', 0);
  });

  it('starts a throttled redrive via universal target', () => {
    const template = synth({
      autoRedrive: { schedule: scheduler.ScheduleExpression.rate(Duration.hours(1)), maxMessagesPerSecond: 5 },
    });
    const schedules = template.findResources('AWS::Scheduler::Schedule');
    const target = JSON.stringify(Object.values(schedules)[0].Properties.Target);
    // ARN and input contain tokens (partition, queue ARN), so check them as text
    expect(target).toContain(':scheduler:::aws-sdk:sqs:startMessageMoveTask');
    expect(target).toContain('\\"MaxNumberOfMessagesPerSecond\\":5');
    expect(target).toContain('"MaximumRetryAttempts":0');
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Action: Match.arrayWith(['sqs:StartMessageMoveTask']) }),
        ]),
      },
    });
  });

  it('rejects maxReceiveCount 1', () => {
    expect(() => synth({ maxReceiveCount: 1 })).toThrow(/at least 2/);
  });
});
