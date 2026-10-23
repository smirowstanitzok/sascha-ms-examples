import { Stack, StackProps, Duration, RemovalPolicy, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";

export class OrdersStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const table = new dynamodb.TableV2(this, "Orders", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      dynamoStream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: RemovalPolicy.DESTROY, // demo only!
    });

    // 1) Live processing: classic trigger via event source mapping
    const live = new NodejsFunction(this, "LiveProcessor", {
      entry: "src/live-handler.ts",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(30),
    });
    live.addEventSource(new DynamoEventSource(table, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      batchSize: 100,
      reportBatchItemFailures: true,
      retryAttempts: 5,
    }));

    // 2) Replay at the push of a button: reads directly from the stream via AT_TIMESTAMP
    const replay = new NodejsFunction(this, "Replay", {
      entry: "src/replay-handler.ts",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.minutes(15),
      memorySize: 512,
      environment: { STREAM_ARN: table.tableStreamArn! },
      // Bundle a current SDK: the SDK included in the runtime may not know AT_TIMESTAMP yet
      bundling: { bundleAwsSDK: true },
    });
    table.grantStreamRead(replay);

    new CfnOutput(this, "ReplayFunctionName", { value: replay.functionName });
  }
}
