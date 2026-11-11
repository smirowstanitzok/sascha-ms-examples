// lib/rental-stack.ts
import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import { HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';
import { fileURLToPath } from 'node:url';

export class RentalStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const rentalFn = new NodejsFunction(this, 'RentalFunction', {
      entry: fileURLToPath(new URL('../src/rental.ts', import.meta.url)),
      handler: 'handler',
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(5),
      logGroup: new LogGroup(this, 'RentalLogs', { retention: RetentionDays.TWO_WEEKS }),
      environment: { STATION_NAME: 'Central Station' },
      bundling: {
        format: OutputFormat.ESM,
        minify: true,
        sourceMap: true,
        // esbuild reads "paths" from this tsconfig and resolves @shared/*
        tsconfig: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
      },
    });

    const api = new HttpApi(this, 'RentalApi');
    api.addRoutes({
      path: '/rentals/quote',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('RentalIntegration', rentalFn),
    });

    new CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
  }
}
