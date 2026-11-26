// lib/patch-check-stack.ts
import { Stack, StackProps, Duration, CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";

export const IMAGE_NAME = "patch-check";
const FUNCTION_NAME = "patch-check";

export class PatchCheckStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const imageArn = `arn:aws:lambda:${this.region}:${this.account}:microvm-image:${IMAGE_NAME}`;
    const functionArnPattern = `arn:aws:lambda:${this.region}:${this.account}:function:${FUNCTION_NAME}:*`;

    // Bucket for the code package of the MicroVM image
    const artifacts = new s3.Bucket(this, "Artifacts", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const lambdaTrust = new iam.ServicePrincipal("lambda.amazonaws.com");

    // Role for the image build: reads the code package and writes logs
    const buildRole = new iam.Role(this, "ImageBuildRole", { assumedBy: lambdaTrust });
    artifacts.grantRead(buildRole);
    buildRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
    );

    // MicroVM role: may only report results to exactly this function
    const microvmRole = new iam.Role(this, "MicrovmRole", { assumedBy: lambdaTrust });
    microvmRole.assumeRolePolicy?.addStatements(
      new iam.PolicyStatement({ actions: ["sts:TagSession"], principals: [lambdaTrust] }),
    );
    microvmRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "lambda:SendDurableExecutionCallbackSuccess",
          "lambda:SendDurableExecutionCallbackFailure",
          "lambda:SendDurableExecutionCallbackHeartbeat",
        ],
        resources: [functionArnPattern],
      }),
    );
    microvmRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
    );

    // The durable function that drives the patch check
    const fn = new NodejsFunction(this, "PatchCheck", {
      functionName: FUNCTION_NAME,
      entry: "src/patch-check.ts",
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 512,
      // At least retryWindow (60 s) + 11 s, otherwise HTTP delivery fails
      timeout: Duration.seconds(120),
      durableConfig: {
        executionTimeout: Duration.hours(1),
        retentionPeriod: Duration.days(7),
      },
      environment: {
        MICROVM_IMAGE_ARN: imageArn,
        MICROVM_ROLE_ARN: microvmRole.roleArn,
      },
      bundling: {
        format: OutputFormat.ESM,
        // Bundle everything: the runtime's AWS SDK may not know the MicroVMs client yet
        externalModules: [],
        banner:
          "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
      },
    });

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "lambda:RunMicrovm",
          "lambda:TerminateMicrovm",
          "lambda:GetMicrovm",
          "lambda:CreateMicrovmAuthToken",
        ],
        resources: ["*"],
      }),
    );
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["lambda:PassNetworkConnector"],
        resources: [
          `arn:aws:lambda:${this.region}:aws:network-connector:aws-network-connector:*`,
        ],
      }),
    );
    microvmRole.grantPassRole(fn.role!);

    // Durable functions need a qualified ARN (version or alias)
    const alias = new lambda.Alias(this, "Live", {
      aliasName: "live",
      version: fn.currentVersion,
    });

    new CfnOutput(this, "AliasArn", { value: alias.functionArn });
    new CfnOutput(this, "ArtifactBucket", { value: artifacts.bucketName });
    new CfnOutput(this, "BuildRoleArn", { value: buildRole.roleArn });
    new CfnOutput(this, "ImageArn", { value: imageArn });
  }
}
