// lib/bike-return-stack.ts
import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import type { Construct } from 'constructs';

export class BikeReturnStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1) Calculate the fee: short Lambda, task timeout just above the Lambda timeout
    const feeFn = new NodejsFunction(this, 'CalculateFeeFn', {
      entry: 'src/calculate-fee.ts',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
    });

    const calculateFee = new tasks.LambdaInvoke(this, 'CalculateFee', {
      lambdaFunction: feeFn,
      payloadResponseOnly: true,
      resultPath: '$.fee',
      taskTimeout: sfn.Timeout.duration(Duration.seconds(15)),
      retryOnServiceExceptions: true,
    });
    calculateFee.addRetry({
      errors: ['Sandbox.Timedout', 'States.Timeout'],
      maxAttempts: 1,
      interval: Duration.seconds(2),
    });

    // 2) Check the battery: callback with task token via SQS, worker sends heartbeats
    const workerFn = new NodejsFunction(this, 'BatteryCheckWorkerFn', {
      entry: 'src/battery-check-worker.ts',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.minutes(4),
      memorySize: 256,
      environment: { HEARTBEAT_INTERVAL_MS: '20000' },
    });

    const dlq = new sqs.Queue(this, 'BatteryCheckDlq', { retentionPeriod: Duration.days(14) });
    const checkQueue = new sqs.Queue(this, 'BatteryCheckQueue', {
      visibilityTimeout: Duration.minutes(24), // 6 × Lambda timeout
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
    });
    workerFn.addEventSource(new SqsEventSource(checkQueue, { batchSize: 1, reportBatchItemFailures: true }));

    const checkBattery = new tasks.SqsSendMessage(this, 'CheckBattery', {
      queue: checkQueue,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      messageBody: sfn.TaskInput.fromObject({
        taskToken: sfn.JsonPath.taskToken,
        rentalId: sfn.JsonPath.stringAt('$.rentalId'),
        bikeId: sfn.JsonPath.stringAt('$.bikeId'),
      }),
      resultPath: '$.battery',
      heartbeatTimeout: sfn.Timeout.duration(Duration.seconds(60)),
      taskTimeout: sfn.Timeout.duration(Duration.minutes(5)),
    });
    checkBattery.addRetry({
      errors: ['BatteryCheck.BikeOffline'],
      maxAttempts: 2,
      interval: Duration.seconds(30),
      backoffRate: 2,
    });

    // 3) If the check hangs or fails: notify the workshop, then abort cleanly
    const workshopTopic = new sns.Topic(this, 'WorkshopTopic');
    const notifyWorkshop = new tasks.SnsPublish(this, 'NotifyWorkshop', {
      topic: workshopTopic,
      message: sfn.TaskInput.fromObject({
        rentalId: sfn.JsonPath.stringAt('$.rentalId'),
        bikeId: sfn.JsonPath.stringAt('$.bikeId'),
        error: sfn.JsonPath.stringAt('$.error.Error'),
      }),
      resultPath: sfn.JsonPath.DISCARD,
    });
    const checkFailed = new sfn.Fail(this, 'CheckFailed', {
      errorPath: '$.error.Error',
      causePath: '$.error.Cause',
    });
    checkBattery.addCatch(notifyWorkshop.next(checkFailed), {
      errors: [
        'States.HeartbeatTimeout',
        'States.Timeout',
        'BatteryCheck.TooSlow',
        'BatteryCheck.BikeOffline',
        'BatteryCheck.Unexpected',
      ],
      resultPath: '$.error',
    });

    const stateMachine = new sfn.StateMachine(this, 'BikeReturnStateMachine', {
      definitionBody: sfn.DefinitionBody.fromChainable(
        calculateFee.next(checkBattery).next(new sfn.Succeed(this, 'ReturnCompleted')),
      ),
      // Upper limit for the whole execution, including all retries
      timeout: Duration.minutes(20),
    });

    // The worker may call SendTaskSuccess, SendTaskFailure and SendTaskHeartbeat
    stateMachine.grantTaskResponse(workerFn);
  }
}
