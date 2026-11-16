// lib/advisor-stream-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

// EU inference profile; check the current ID in the Bedrock console.
const MODEL = 'anthropic.claude-sonnet-4-5-20250929-v1:0';
const PROFILE = `eu.${MODEL}`;

export class AdvisorStreamStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const fn = new nodejs.NodejsFunction(this, 'AdvisorFunction', {
      entry: 'src/handler.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: cdk.Duration.seconds(90),
      environment: { MODEL_ID: PROFILE },
      logGroup: new logs.LogGroup(this, 'AdvisorLogs', {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      bundling: {
        format: nodejs.OutputFormat.ESM,
        target: 'node24',
        minify: true,
        sourceMap: true,
      },
    });

    // ConverseStream needs this action – on the profile and the models behind it.
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${PROFILE}`,
          `arn:aws:bedrock:*::foundation-model/${MODEL}`,
        ],
      }),
    );

    const url = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });

    new cdk.CfnOutput(this, 'AdvisorUrl', { value: url.url });
  }
}
