// lib/cinema-flags-stack.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import * as appconfig from "aws-cdk-lib/aws-appconfig";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";

export class CinemaFlagsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const appName = "cinema-tickets";
    const stageName = "prod";
    const profileName = "ticket-flags";

    // 1. AppConfig application
    const app = new appconfig.Application(this, "CinemaApp", { applicationName: appName });

    // 2. Rollout strategy: 20 % more every 2 minutes, then 5 minutes of observation
    const strategy = new appconfig.DeploymentStrategy(this, "GradualRollout", {
      deploymentStrategyName: "cinema-linear-20",
      rolloutStrategy: appconfig.RolloutStrategy.linear({
        growthFactor: 20,
        deploymentDuration: Duration.minutes(10),
        finalBakeTime: Duration.minutes(5),
      }),
    });

    // 3. Lambda function with the AppConfig Agent extension as a layer.
    // The layer list in CDK can lag behind the latest version:
    // "cdk deploy -c appConfigLayerArn=<ARN>" overrides it.
    const layerArn: string | undefined =
      this.node.tryGetContext("appConfigLayerArn") ??
      appconfig.Application.getLambdaLayerVersionArn(this.region, appconfig.Platform.ARM_64);
    if (!layerArn) {
      throw new Error(`No AppConfig layer ARN found for region ${this.region}`);
    }

    const priceFn = new NodejsFunction(this, "PriceFunction", {
      entry: join(__dirname, "../src/price-handler.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(5),
      layers: [lambda.LayerVersion.fromLayerVersionArn(this, "AppConfigAgentLayer", layerArn)],
      environment: {
        APPCONFIG_APPLICATION: appName,
        APPCONFIG_ENVIRONMENT: stageName,
        APPCONFIG_PROFILE: profileName,
        AWS_APPCONFIG_EXTENSION_POLL_INTERVAL_SECONDS: "30",
        AWS_APPCONFIG_EXTENSION_PREFETCH_LIST: `/applications/${appName}/environments/${stageName}/configurations/${profileName}`,
      },
    });

    // 4. Alarm: if the function throws errors, AppConfig rolls back the running change
    const errorAlarm = new cloudwatch.Alarm(this, "PriceErrorsAlarm", {
      metric: priceFn.metricErrors({ period: Duration.minutes(1) }),
      threshold: 3,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: "Errors in the price function: AppConfig rolls back running flag changes",
    });

    const env = new appconfig.Environment(this, "ProdEnv", {
      application: app,
      environmentName: stageName,
      monitors: [appconfig.Monitor.fromCloudWatchAlarm(errorAlarm)],
    });

    new appconfig.HostedConfiguration(this, "TicketFlags", {
      application: app,
      name: profileName,
      type: appconfig.ConfigurationType.FEATURE_FLAGS,
      content: appconfig.ConfigurationContent.fromInlineJson(
        readFileSync(join(__dirname, "../flags/feature-flags.json"), "utf8"),
      ),
      deploymentStrategy: strategy,
      deployTo: [env],
    });

    // 5. Read-only permissions for the extension, limited to this application.
    // Deliberately not env.grantReadConfig(): environment -> alarm -> function -> role -> environment
    // would be a circular dependency in CloudFormation.
    priceFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["appconfig:StartConfigurationSession", "appconfig:GetLatestConfiguration"],
        resources: [
          this.formatArn({
            service: "appconfig",
            resource: "application",
            resourceName: `${app.applicationId}/environment/*/configuration/*`,
          }),
        ],
      }),
    );

    // 6. HTTP API in front
    const api = new apigwv2.HttpApi(this, "TicketApi");
    api.addRoutes({
      path: "/price",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration("PriceIntegration", priceFn),
    });

    new CfnOutput(this, "PriceUrl", { value: `${api.apiEndpoint}/price?seat=premium&tickets=2` });
    new CfnOutput(this, "ApplicationId", { value: app.applicationId });
    new CfnOutput(this, "EnvironmentId", { value: env.environmentId });
    new CfnOutput(this, "DeploymentStrategyId", { value: strategy.deploymentStrategyId });
  }
}
