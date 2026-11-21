// lib/agent-gate-stack.ts
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import type { Construct } from 'constructs';

export class AgentGateStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1. Table with the agent keys (hashes only, never plain tokens)
    const agents = new dynamodb.TableV2(this, 'AgentKeys', {
      partitionKey: { name: 'tokenHash', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const lambdaDefaults = {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 1024,
      bundling: { minify: true, format: OutputFormat.ESM },
    };

    // 2. Check service: decides on token, scope and daily budget
    const checkAgent = new NodejsFunction(this, 'CheckAgentFn', {
      ...lambdaDefaults,
      entry: 'src/check-agent.ts',
      timeout: Duration.seconds(2),
      environment: { AGENT_TABLE: agents.tableName },
    });
    agents.grantReadWriteData(checkAgent);
    const checkUrl = checkAgent.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.AWS_IAM });

    // 3. The actual API, here a small bike rental
    const bikeApi = new NodejsFunction(this, 'BikeApiFn', {
      ...lambdaDefaults,
      entry: 'src/bike-api.ts',
      timeout: Duration.seconds(5),
    });
    const apiUrl = bikeApi.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.AWS_IAM });

    // 4. CloudFront Functions (runtime 2.0 is required for cf.fetch)
    const agentGate = new cloudfront.Function(this, 'AgentGate', {
      code: cloudfront.FunctionCode.fromFile({ filePath: 'edge/agent-gate.js' }),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment: 'Checks AI agents via cf.fetch',
    });
    const blockInternal = new cloudfront.Function(this, 'BlockInternal', {
      code: cloudfront.FunctionCode.fromFile({ filePath: 'edge/block-internal.js' }),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    // 5. Both function URLs as origins with OAC, fixed origin IDs for cf.fetch
    const apiOrigin = origins.FunctionUrlOrigin.withOriginAccessControl(apiUrl, { originId: 'bike-api' });
    const authOrigin = origins.FunctionUrlOrigin.withOriginAccessControl(checkUrl, { originId: 'agent-auth' });

    const distribution = new cloudfront.Distribution(this, 'AgentApi', {
      comment: 'Bike rental API for AI agents',
      defaultBehavior: {
        origin: apiOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        functionAssociations: [{ function: agentGate, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      additionalBehaviors: {
        // This behavior only exists so the check service is an origin of the distribution.
        // From outside it always returns 404, cf.fetch talks to the origin directly.
        '/_agent-auth/*': {
          origin: authOrigin,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          functionAssociations: [{ function: blockInternal, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
        },
      },
    });

    new CfnOutput(this, 'ApiUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'AgentTable', { value: agents.tableName });
  }
}
