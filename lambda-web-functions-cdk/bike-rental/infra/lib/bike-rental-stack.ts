// infra/lib/bike-rental-stack.ts
import * as path from "node:path";
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_dynamodb as dynamodb,
  aws_iam as iam,
  aws_lambda as lambda,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export class BikeRentalStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1) Table for the bikes
    const table = new dynamodb.Table(this, "Bikes", {
      partitionKey: { name: "bikeId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // demo only
    });

    // 2) Web Function as an L2 construct: bucket, role, revision and endpoint in one
    const bikeApi = new lambda.WebFunction(this, "BikeApi", {
      webFunctionName: "bike-rental",
      code: lambda.WebFunctionCode.fromAssetToManagedBucket(
        path.join(__dirname, "../../app/dist"),
      ),
      runtime: lambda.WebFunctionRuntime.NODEJS_24_X,
      timeout: Duration.seconds(30),
      maxConcurrencyPerEnvironment: 64,
      environment: { NODE_ENV: "production", TABLE_NAME: table.tableName },
      defaultEndpointAuth: lambda.WebFunctionAuthType.IAM_AUTH,
      defaultEndpoint: { rateLimit: 200, maxEnvironments: 10 },
    });

    // 3) Permissions: the execution role may read and write, nothing else
    table.grantReadWriteData(bikeApi);

    // 4) Origin access control for Web Functions: only "always-amz-auth" is allowed
    const oac = new cloudfront.FunctionUrlOriginAccessControl(this, "BikeApiOac", {
      signing: cloudfront.Signing.SIGV4_ALWAYS_AMZ_AUTH,
    });

    // 5) CloudFront in front, OAC set directly on the origin – no escape hatch needed
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: new origins.HttpOrigin(bikeApi.endpoint.domainName, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          originAccessControlId: oac.originAccessControlId,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        // Do NOT forward the Host header, or the endpoint answers with 404
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
    });

    // 6) Only this distribution may call the endpoint (goes into the resource policy)
    bikeApi.endpoint.grants.invoke(
      new iam.ServicePrincipal("cloudfront.amazonaws.com", {
        conditions: { ArnLike: { "aws:SourceArn": distribution.distributionArn } },
      }),
    );

    new CfnOutput(this, "CloudFrontUrl", { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, "EndpointDomain", { value: bikeApi.endpoint.domainName });
  }
}
