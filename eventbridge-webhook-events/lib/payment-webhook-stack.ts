// lib/payment-webhook-stack.ts
import { CfnOutput, CfnResource, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { CfnEventBus, CfnSubscriber } from 'aws-cdk-lib/aws-eventsv2';
import { PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';

export class PaymentWebhookStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1. The new-generation bus (AWS::EventsV2), events stay available for 7 days
    const bus = new CfnEventBus(this, 'PaymentBus', {
      name: 'radwerk-payments',
      description: 'Payment events of the bike rental',
      storageConfiguration: { retentionPeriodInDays: 7 },
    });

    // 2. EventBridge uses this role to read the secret and write to the bus
    const webhookRole = new Role(this, 'WebhookRole', {
      assumedBy: new ServicePrincipal('events.amazonaws.com'),
      inlinePolicies: {
        webhook: new PolicyDocument({
          statements: [
            new PolicyStatement({ actions: ['events:PutWebhookEvents'], resources: [bus.attrEventBusArn] }),
            new PolicyStatement({
              actions: ['secretsmanager:GetSecretValue'],
              // EventBridge creates the secret itself, its name starts with "events-webhook!"
              resources: [`arn:${this.partition}:secretsmanager:${this.region}:${this.account}:secret:events-webhook!*`],
            }),
          ],
        }),
      },
    });

    // 3. The webhook source. The L1 construct doesn't know WebhookEventsConfiguration yet,
    //    so we write the CloudFormation resource directly.
    const webhook = new CfnResource(this, 'KassenfuchsWebhook', {
      type: 'AWS::EventsV2::EventSource',
      properties: {
        Name: 'kassenfuchs-payments',
        EventBusArn: bus.attrEventBusArn,
        Configuration: {
          WebhookEventsConfiguration: {
            RoleArn: webhookRole.roleArn,
            AuthConfiguration: {
              // Standard Webhooks: webhook-id, webhook-timestamp, webhook-signature
              HmacAuthConfiguration: {
                Algorithm: 'SHA256',
                Encoding: 'BASE64',
                SignedMessageComposition: 'MESSAGE_ID_DOT_TIMESTAMP_DOT_BODY',
                SignatureHttpHeader: 'webhook-signature',
                SignaturePrefix: 'v1,',
                Delimiter: ' ',
                MessageIdHttpHeader: 'webhook-id',
                TimestampHttpHeader: 'webhook-timestamp',
                TimestampToleranceInSeconds: 300,
                SecretEncoding: 'BASE64',
                // No SecretValue: EventBridge generates the secret itself
              },
            },
            // EventBridge drops identical retries within 5 minutes
            DeduplicationConfiguration: { DeduplicationType: 'CONTENT_BASED' },
          },
        },
      },
    });
    webhook.node.addDependency(webhookRole);

    // 4. Table for bookings and idempotency markers (markers expire via TTL)
    const table = new Table(this, 'Payments', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: RemovalPolicy.DESTROY, // example only
    });

    // 5. The function that books payments
    const paymentFn = new NodejsFunction(this, 'PaymentEvents', {
      entry: 'src/payment-events.ts',
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(20),
      environment: { TABLE_NAME: table.tableName },
      logGroup: new LogGroup(this, 'PaymentEventsLogs', {
        retention: RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });
    table.grantWriteData(paymentFn);

    // 6. Subscriber: filters payment events and invokes the function
    const dlq = new Queue(this, 'SubscriberDlq', { retentionPeriod: Duration.days(14) });
    const deliveryRole = new Role(this, 'DeliveryRole', {
      assumedBy: new ServicePrincipal('events.amazonaws.com'),
    });
    paymentFn.grantInvoke(deliveryRole);
    dlq.grantSendMessages(deliveryRole);

    const subscriber = new CfnSubscriber(this, 'PaymentSubscriber', {
      name: 'payment-events',
      eventBusArn: bus.attrEventBusArn,
      filterConfiguration: {
        // Webhook events have no envelope: the pattern matches the body directly
        filters: [{ scope: 'DATA', pattern: JSON.stringify({ type: ['payment.succeeded', 'payment.refunded'] }) }],
      },
      invokeConfiguration: {
        targetArn: paymentFn.functionArn,
        roleArn: deliveryRole.roleArn,
        // Invoke synchronously: if the function throws, EventBridge retries the delivery
        lambdaParameters: { invocationType: 'REQUEST_RESPONSE', invocationTimeoutSeconds: '25' },
      },
      batchConfiguration: { maxBatchSize: 10, maxBatchWindowInSeconds: 1 },
      retryPolicy: { maxRetryAttempts: 8, maxEventAgeInSeconds: 3600 },
      onFailureConfiguration: { arn: dlq.queueArn },
    });
    // The role needs its permissions before the subscriber attempts the first delivery
    subscriber.node.addDependency(deliveryRole);

    new CfnOutput(this, 'WebhookSourceArn', { value: webhook.getAtt('EventSourceArn').toString() });
    new CfnOutput(this, 'TableName', { value: table.tableName });
  }
}
