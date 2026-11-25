// lib/assistant-stack.ts
import { fileURLToPath } from 'node:url';
import * as cdk from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

export class RentalAssistantStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const issuer = new cdk.CfnParameter(this, 'JwtIssuer', { type: 'String' });
    const audience = new cdk.CfnParameter(this, 'JwtAudience', { type: 'String' });
    const modelId = new cdk.CfnParameter(this, 'ModelId', {
      type: 'String',
      description: 'Bedrock model or inference profile ID with tool use support',
    });

    const bucket = new s3.Bucket(this, 'ShopDocs', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const fn = new NodejsFunction(this, 'AssistantFn', {
      entry: fileURLToPath(new URL('../src/handler.ts', import.meta.url)),
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      environment: {
        DOCS_BUCKET: bucket.bucketName,
        MODEL_ID: modelId.valueAsString,
      },
      logGroup: new logs.LogGroup(this, 'AssistantLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
      }),
    });

    // The role may access all shops: this is the upper bound.
    bucket.grantRead(fn);
    bucket.grantPut(fn);
    // Without this permission STS rejects the call (implicit deny).
    fn.addToRolePolicy(
      new iam.PolicyStatement({ actions: ['sts:GetScopedCredentials'], resources: ['*'] }),
    );
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          'arn:aws:bedrock:*::foundation-model/*',
          `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
        ],
      }),
    );

    const api = new apigw.HttpApi(this, 'AssistantApi', {
      defaultAuthorizer: new HttpJwtAuthorizer('ShopJwt', issuer.valueAsString, {
        jwtAudience: [audience.valueAsString],
      }),
    });
    api.addRoutes({
      path: '/ask',
      methods: [apigw.HttpMethod.POST],
      integration: new HttpLambdaIntegration('AskIntegration', fn),
    });

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName });
  }
}
