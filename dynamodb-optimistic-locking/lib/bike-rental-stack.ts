// lib/bike-rental-stack.ts
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AttributeType, Billing, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

export class BikeRentalStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const table = new TableV2(this, 'BikesTable', {
      partitionKey: { name: 'bikeId', type: AttributeType.STRING },
      billing: Billing.onDemand(),
      removalPolicy: RemovalPolicy.DESTROY, // demo only: in production use RETAIN
    });

    const fn = new NodejsFunction(this, 'BikesFunction', {
      entry: 'src/handlers/bikes.ts',
      handler: 'handler',
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(10),
      environment: { TABLE_NAME: table.tableName },
      logGroup: new LogGroup(this, 'BikesLogs', {
        retention: RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      bundling: { format: OutputFormat.ESM, minify: true, sourceMap: true },
    });
    table.grantReadWriteData(fn);

    const api = new HttpApi(this, 'BikesApi');
    const integration = new HttpLambdaIntegration('BikesIntegration', fn);
    const routes: Array<[HttpMethod, string]> = [
      [HttpMethod.POST, '/bikes'],
      [HttpMethod.GET, '/bikes/{bikeId}'],
      [HttpMethod.PATCH, '/bikes/{bikeId}'],
      [HttpMethod.POST, '/bikes/{bikeId}/rent'],
      [HttpMethod.POST, '/bikes/{bikeId}/return'],
    ];
    for (const [method, path] of routes) {
      api.addRoutes({ path, methods: [method], integration });
    }

    new CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
    new CfnOutput(this, 'TableName', { value: table.tableName });
  }
}
