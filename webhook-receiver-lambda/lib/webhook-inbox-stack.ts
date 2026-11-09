// lib/webhook-inbox-stack.ts
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SECRET_PARAMETER = '/radstation/webhooks/payment-secret';

export class WebhookInboxStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Remembers every webhook-id for 7 days (TTL cleans up automatically)
    const inbox = new dynamodb.TableV2(this, 'WebhookInbox', {
      partitionKey: { name: 'webhookId', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: RemovalPolicy.DESTROY, // demo only
    });

    const deadLetters = new sqs.Queue(this, 'PaymentEventsDlq', {
      retentionPeriod: Duration.days(14),
    });
    const queue = new sqs.Queue(this, 'PaymentEvents', {
      visibilityTimeout: Duration.seconds(60), // at least 6 times the worker timeout
      deadLetterQueue: { queue: deadLetters, maxReceiveCount: 5 },
    });

    const common = {
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      bundling: { format: OutputFormat.ESM, minify: true, sourceMap: true },
      environment: {
        INBOX_TABLE: inbox.tableName,
        NODE_OPTIONS: '--enable-source-maps',
      },
    };

    const receiver = new NodejsFunction(this, 'WebhookReceiver', {
      ...common,
      entry: path.join(here, '../src/receiver.ts'),
      timeout: Duration.seconds(5), // senders don't wait forever, neither do we
      environment: {
        ...common.environment,
        QUEUE_URL: queue.queueUrl,
        SECRET_PARAMETER_NAME: SECRET_PARAMETER,
      },
      logGroup: new logs.LogGroup(this, 'ReceiverLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    const worker = new NodejsFunction(this, 'WebhookWorker', {
      ...common,
      entry: path.join(here, '../src/worker.ts'),
      timeout: Duration.seconds(10),
      logGroup: new logs.LogGroup(this, 'WorkerLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    // Permissions: as few as possible
    inbox.grant(receiver, 'dynamodb:PutItem', 'dynamodb:DeleteItem');
    inbox.grant(worker, 'dynamodb:GetItem', 'dynamodb:UpdateItem');
    queue.grantSendMessages(receiver);
    receiver.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [this.formatArn({ service: 'ssm', resource: 'parameter', resourceName: SECRET_PARAMETER.slice(1) })],
      }),
    );

    worker.addEventSource(
      new SqsEventSource(queue, { batchSize: 10, reportBatchItemFailures: true }),
    );

    // Public HTTPS endpoint – the signature check in code is the authentication
    const url = receiver.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });

    new CfnOutput(this, 'WebhookUrl', { value: url.url });
    new CfnOutput(this, 'DeadLetterQueueUrl', { value: deadLetters.queueUrl });
  }
}
