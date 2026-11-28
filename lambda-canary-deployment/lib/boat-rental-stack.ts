// lib/boat-rental-stack.ts
import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import { HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import type { Construct } from 'constructs';

export class BoatRentalStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1. The function that serves real traffic.
    const priceFn = new NodejsFunction(this, 'PriceFunction', {
      entry: 'src/price-handler.ts',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(5),
    });

    // 2. A stable alias. Every code change creates a new version,
    //    CodeDeploy then shifts the alias step by step to it.
    const liveAlias = new lambda.Alias(this, 'LiveAlias', {
      aliasName: 'live',
      version: priceFn.currentVersion,
    });

    // 3. The API calls the alias, never the function directly.
    const api = new HttpApi(this, 'BoatRentalApi');
    api.addRoutes({
      path: '/price',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('PriceIntegration', liveAlias),
    });

    // 4. Alarm: error rate on the alias above 2 percent within one minute.
    const errorRate = new cloudwatch.MathExpression({
      expression: '100 * errors / MAX([invocations, 1])',
      usingMetrics: {
        errors: liveAlias.metricErrors({ period: Duration.minutes(1), statistic: 'Sum' }),
        invocations: liveAlias.metricInvocations({ period: Duration.minutes(1), statistic: 'Sum' }),
      },
      label: 'Error rate (%)',
      period: Duration.minutes(1),
    });
    const errorRateAlarm = new cloudwatch.Alarm(this, 'CanaryErrorRateAlarm', {
      metric: errorRate,
      threshold: 2,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Rolls back the canary deployment of the price function',
    });

    // 5. Smoke test that runs against the new version before any traffic moves.
    const preTrafficHook = new NodejsFunction(this, 'PreTrafficHook', {
      entry: 'src/pre-traffic-hook.ts',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: Duration.minutes(1),
      environment: { TARGET_VERSION_ARN: priceFn.currentVersion.functionArn },
    });
    priceFn.currentVersion.grantInvoke(preTrafficHook);

    // 6. CodeDeploy: 10 percent for five minutes, then the rest.
    new codedeploy.LambdaDeploymentGroup(this, 'PriceDeploymentGroup', {
      alias: liveAlias,
      deploymentConfig: codedeploy.LambdaDeploymentConfig.CANARY_10PERCENT_5MINUTES,
      preHook: preTrafficHook,
      alarms: [errorRateAlarm],
      autoRollback: {
        failedDeployment: true,
        stoppedDeployment: true,
        deploymentInAlarm: true,
      },
    });

    new CfnOutput(this, 'PriceUrl', { value: `${api.apiEndpoint}/price?boat=kayak&hours=2` });
  }
}
