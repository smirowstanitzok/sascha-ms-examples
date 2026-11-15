// lib/bookshop-picks-stack.ts
import { ArnFormat, CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

export interface BookshopPicksProps extends StackProps {
  /** Name of an existing ElastiCache Serverless cache (Valkey) with a public endpoint */
  cacheName: string;
  cacheHost: string;
  /** ElastiCache user with IAM authentication */
  cacheUser?: string;
  modelId?: string;
  /** Bundle in the Lambda build image (default). Tests switch this off. */
  dockerBundling?: boolean;
}

export class BookshopPicksStack extends Stack {
  constructor(scope: Construct, id: string, props: BookshopPicksProps) {
    super(scope, id, props);
    const cacheUser = props.cacheUser ?? "default.iam-user";
    const modelId = props.modelId ?? "eu.amazon.nova-lite-v1:0";

    const picksFn = new NodejsFunction(this, "PicksFn", {
      entry: "src/handler.ts",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.X86_64,
      memorySize: 512,
      timeout: Duration.seconds(25), // longer than lockMs (20 s) plus the cache calls
      logGroup: new logs.LogGroup(this, "PicksLogs", { retention: logs.RetentionDays.TWO_WEEKS }),
      environment: {
        CACHE_NAME: props.cacheName,
        CACHE_HOST: props.cacheHost,
        CACHE_USER: cacheUser,
        MODEL_ID: modelId,
        FRESH_SECONDS: "600",
        STALE_SECONDS: "3600",
      },
      bundling: {
        format: OutputFormat.CJS,
        // GLIDE ships a native library: install it inside the Lambda build image
        nodeModules: ["@valkey/valkey-glide"],
        forceDockerBundling: props.dockerBundling ?? true,
      },
    });

    picksFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["elasticache:Connect"],
        resources: [
          this.formatArn({ service: "elasticache", resource: "serverlesscache", resourceName: props.cacheName, arnFormat: ArnFormat.COLON_RESOURCE_NAME }),
          this.formatArn({ service: "elasticache", resource: "user", resourceName: cacheUser, arnFormat: ArnFormat.COLON_RESOURCE_NAME }),
        ],
      }),
    );
    picksFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: [
          `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${modelId}`,
          "arn:aws:bedrock:*::foundation-model/amazon.nova-lite-v1:0",
        ],
      }),
    );

    const api = new HttpApi(this, "PicksApi");
    api.addRoutes({
      path: "/picks/{genre}",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("PicksIntegration", picksFn),
    });

    new CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
  }
}
