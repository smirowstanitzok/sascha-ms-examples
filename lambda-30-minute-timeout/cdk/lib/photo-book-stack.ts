// cdk/lib/photo-book-stack.ts
import { fileURLToPath } from 'node:url';
import { Duration, RemovalPolicy, Stack, Validations, type StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';

const FUNCTION_TIMEOUT = Duration.minutes(30);

export class PhotoBookStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const dlq = new sqs.Queue(this, 'RenderDlq', { retentionPeriod: Duration.days(14) });

    // At least six times the function timeout (AWS recommendation)
    const queue = new sqs.Queue(this, 'RenderQueue', {
      visibilityTimeout: Duration.seconds(FUNCTION_TIMEOUT.toSeconds() * 6),
      retentionPeriod: Duration.days(4),
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
    });

    const table = new dynamodb.TableV2(this, 'CheckpointTable', {
      partitionKey: { name: 'orderId', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const renderFn = new NodejsFunction(this, 'RenderPhotoBook', {
      entry: fileURLToPath(new URL('../../src/index.ts', import.meta.url)),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 2048,
      timeout: FUNCTION_TIMEOUT,
      logGroup: new logs.LogGroup(this, 'RenderLogs', {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      bundling: { format: OutputFormat.ESM, target: 'node22' },
      environment: {
        CHECKPOINT_TABLE: table.tableName,
        RENDER_QUEUE_URL: queue.queueUrl,
      },
    });

    // The local CloudFormation check still knows only 900 seconds
    Validations.of(renderFn).acknowledge({
      id: 'CloudFormation-Validate::E3717',
      reason: 'Lambda supports a 30-minute timeout since November 19, 2026',
    });

    renderFn.addEventSource(new SqsEventSource(queue, { batchSize: 1, reportBatchItemFailures: true }));
    table.grantReadWriteData(renderFn);
    queue.grantSendMessages(renderFn);
  }
}
