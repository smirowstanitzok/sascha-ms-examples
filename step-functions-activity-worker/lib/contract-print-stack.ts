// lib/contract-print-stack.ts
import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import type { Construct } from 'constructs';

export class ContractPrintStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // The activity is just a "queue with an ARN" – it contains no code
    const printActivity = new sfn.Activity(this, 'PrintContractActivity', {
      activityName: 'speichenwerk-print-contract',
    });

    const prepare = new sfn.Pass(this, 'PrepareContract', {
      parameters: {
        'rentalId.$': '$.rentalId',
        'customerName.$': '$.customerName',
        'bikeId.$': '$.bikeId',
      },
    });

    const printContract = new tasks.StepFunctionsInvokeActivity(this, 'PrintContract', {
      activity: printActivity,
      // No sign of life for 30 s means the worker is considered lost
      heartbeatTimeout: sfn.Timeout.duration(Duration.seconds(30)),
      // Hard upper limit, including the wait time in the activity queue
      taskTimeout: sfn.Timeout.duration(Duration.minutes(10)),
      resultPath: '$.print',
    });

    printContract.addRetry({
      errors: ['States.HeartbeatTimeout'],
      maxAttempts: 2,
      interval: Duration.seconds(5),
      backoffRate: 2,
    });

    const printFailed = new sfn.Fail(this, 'PrintFailed', {
      error: 'ContractNotPrinted',
      cause: 'The rental contract could not be printed',
    });
    printContract.addCatch(printFailed, { resultPath: '$.error' });

    const stateMachine = new sfn.StateMachine(this, 'RentalCheckout', {
      stateMachineName: 'speichenwerk-rental-checkout',
      definitionBody: sfn.DefinitionBody.fromChainable(
        prepare.next(printContract).next(new sfn.Succeed(this, 'ReadyForPickup')),
      ),
      stateMachineType: sfn.StateMachineType.STANDARD,
      timeout: Duration.minutes(30),
    });

    // Role for the shop PC: may only poll and answer this one activity
    const workerRole = new iam.Role(this, 'ShopWorkerRole', {
      assumedBy: new iam.AccountRootPrincipal(),
      description: 'Activity worker in the shop (print station)',
    });
    printActivity.grant(
      workerRole,
      'states:GetActivityTask',
      'states:SendTaskSuccess',
      'states:SendTaskFailure',
      'states:SendTaskHeartbeat',
    );

    // Tasks waiting longer than 60 s for a worker? Workers are missing or overloaded
    printActivity
      .metricScheduleTime({ statistic: 'Maximum', period: Duration.minutes(5) })
      .createAlarm(this, 'WorkerMissingAlarm', {
        threshold: 60_000,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: 'Print tasks are waiting too long for the shop worker',
      });

    new CfnOutput(this, 'ActivityArn', { value: printActivity.activityArn });
    new CfnOutput(this, 'StateMachineArn', { value: stateMachine.stateMachineArn });
    new CfnOutput(this, 'WorkerRoleArn', { value: workerRole.roleArn });
  }
}
