// lib/library-search-stack.ts
import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

export const WEB_ACL_NAME = 'book-search-mcp-protection';

export class LibrarySearchStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1. MCP server as a Lambda function
    const mcpFunction = new NodejsFunction(this, 'McpFunction', {
      entry: 'lambda/mcp-handler.ts',
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
    });

    // 2. REST API (AI Security supports REST APIs, not HTTP APIs)
    const api = new apigw.RestApi(this, 'BookSearchApi', {
      restApiName: 'city-library-book-search',
      deployOptions: { stageName: 'prod', throttlingRateLimit: 20, throttlingBurstLimit: 40 },
    });
    api.root.addResource('mcp').addMethod('POST', new apigw.LambdaIntegration(mcpFunction));

    // 3. Web ACL with a base rule; the script adds the AI Security rule
    const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      name: WEB_ACL_NAME,
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: WEB_ACL_NAME,
      },
      rules: [
        {
          name: 'Rate-limit-per-IP',
          priority: 10,
          action: { block: {} },
          statement: { rateBasedStatement: { limit: 300, aggregateKeyType: 'IP' } },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'Rate-limit-per-IP',
          },
        },
      ],
    });

    new wafv2.CfnWebACLAssociation(this, 'WebAclAssociation', {
      resourceArn: api.deploymentStage.stageArn,
      webAclArn: webAcl.attrArn,
    });

    // 4. Role that AWS WAF uses to call Bedrock Guardrails
    const wafRole = new iam.Role(this, 'WafBedrockRole', {
      assumedBy: new iam.ServicePrincipal('wafv2.amazonaws.com', {
        conditions: {
          StringEquals: { 'aws:SourceAccount': this.account },
          ArnEquals: { 'aws:SourceArn': webAcl.attrArn },
        },
      }),
      description: 'AWS WAF AI Security uses it to call InvokeGuardrailChecks',
    });
    wafRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeGuardrailChecks'],
        resources: ['*'], // the action has no resource types
        conditions: { StringEquals: { 'aws:RequestedRegion': this.region } },
      }),
    );

    // 5. Alarm: Bedrock calls fail, messages pass unchecked
    const labelMetric = (metricName: string) =>
      new cloudwatch.Metric({
        namespace: 'AWS/WAFV2',
        metricName,
        dimensionsMap: {
          WebACL: WEB_ACL_NAME,
          Region: this.region,
          LabelNamespace: 'awswaf:managed:aws:ai-security:guardrails',
          LabelName: 'call_failed',
        },
        statistic: 'Sum',
        period: Duration.minutes(5),
      });

    new cloudwatch.Alarm(this, 'GuardrailsCallFailed', {
      metric: new cloudwatch.MathExpression({
        expression: 'FILL(allowed, 0) + FILL(blocked, 0)',
        usingMetrics: {
          allowed: labelMetric('AllowedRequests'),
          blocked: labelMetric('BlockedRequests'),
        },
        period: Duration.minutes(5),
        label: 'Messages without Bedrock check',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    new CfnOutput(this, 'McpUrl', { value: api.urlForPath('/mcp') });
    new CfnOutput(this, 'WebAclName', { value: WEB_ACL_NAME });
    new CfnOutput(this, 'WebAclId', { value: webAcl.attrId });
    new CfnOutput(this, 'WafRoleArn', { value: wafRole.roleArn });
  }
}
