// lib/live-ticker-stack.ts
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { WebSocketApi, WebSocketStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

export class LiveTickerStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1. Table for open connections, with an index per match and TTL
    const connections = new Table(this, 'Connections', {
      partitionKey: { name: 'connectionId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: RemovalPolicy.DESTROY, // for the example only
    });
    connections.addGlobalSecondaryIndex({
      indexName: 'byMatch',
      partitionKey: { name: 'matchId', type: AttributeType.STRING },
    });

    // 2. Shared settings for all functions
    const common: NodejsFunctionProps = {
      entry: 'src/handlers.ts',
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: { TABLE_NAME: connections.tableName },
      bundling: { minify: true },
    };
    const fn = (id: string, props: Partial<NodejsFunctionProps>) =>
      new NodejsFunction(this, id, {
        ...common,
        ...props,
        logGroup: new LogGroup(this, `${id}Logs`, {
          retention: RetentionDays.ONE_WEEK,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
      });
    const connectFn = fn('ConnectFn', { handler: 'connect' });
    const disconnectFn = fn('DisconnectFn', { handler: 'disconnect' });
    const pingFn = fn('PingFn', { handler: 'ping' });

    // 3. WebSocket API with $connect, $disconnect and the route "ping"
    const api = new WebSocketApi(this, 'TickerApi', {
      routeSelectionExpression: '$request.body.action',
      connectRouteOptions: { integration: new WebSocketLambdaIntegration('Connect', connectFn) },
      disconnectRouteOptions: { integration: new WebSocketLambdaIntegration('Disconnect', disconnectFn) },
    });
    api.addRoute('ping', {
      integration: new WebSocketLambdaIntegration('Ping', pingFn),
      returnResponse: true, // the Lambda return value goes back to the client
    });

    const stage = new WebSocketStage(this, 'LiveStage', {
      webSocketApi: api,
      stageName: 'live',
      autoDeploy: true,
      throttle: { rateLimit: 50, burstLimit: 100 },
    });

    // 4. Publisher: reads connections and sends messages through @connections
    const publishFn = fn('PublishFn', {
      handler: 'publish',
      timeout: Duration.seconds(60),
      environment: { TABLE_NAME: connections.tableName, CALLBACK_URL: stage.callbackUrl },
    });

    // 5. Permissions as narrow as possible
    connections.grantWriteData(connectFn);
    connections.grantWriteData(disconnectFn);
    connections.grantReadWriteData(publishFn);
    api.grantManageConnections(publishFn);

    new CfnOutput(this, 'WebSocketUrl', { value: stage.url });
    new CfnOutput(this, 'PublishFunctionName', { value: publishFn.functionName });
  }
}
