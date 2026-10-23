import * as path from "node:path";
import {
  CfnOutput,
  Fn,
  RemovalPolicy,
  Stack,
  StackProps,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
} from "aws-cdk-lib";
import { Construct } from "constructs";

const FUNCTION_NAME = "hallo-web";
const ENDPOINT_NAME = "prod";

export class WebAppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1) Versioned bucket for the deployment packages
    const codeBucket = new s3.Bucket(this, "CodeBucket", {
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Lambda may only read code for revisions of this one web function
    codeBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowLambdaWebFunctionCodeAccess",
        principals: [new iam.ServicePrincipal("lambda.amazonaws.com")],
        actions: ["s3:GetObject", "s3:GetObjectVersion"],
        resources: [codeBucket.arnForObjects("*")],
        conditions: {
          ArnLike: {
            "aws:SourceArn": `arn:${this.partition}:lambda:${this.region}:${this.account}:web-function/${FUNCTION_NAME}/revision/*`,
          },
        },
      }),
    );

    // 2) Upload the bundled dist/index.js as a ZIP (do not extract)
    const upload = new s3deploy.BucketDeployment(this, "UploadCode", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../app/dist"))],
      destinationBucket: codeBucket,
      extract: false,
      prune: false,
    });
    const codeKey = Fn.select(0, upload.objectKeys);

    // 3) Execution role with log permissions
    const executionRole = new iam.Role(this, "ExecutionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
      ],
    });

    // 4) Web function = shell for revisions and endpoints
    const webFunction = new lambda.CfnWebFunction(this, "WebFunction", {
      functionName: FUNCTION_NAME,
    });

    // 5) Revision = immutable snapshot of code and configuration
    const revision = new lambda.CfnWebFunctionRevision(this, "Revision", {
      functionName: webFunction.ref,
      buildConfig: {
        codeConfig: { s3Object: { bucket: codeBucket.bucketName, key: codeKey } },
        runtimeConfig: { runtime: "nodejs24.x" },
      },
      serviceConfig: {
        executionRoleArn: executionRole.roleArn,
        timeoutSeconds: 30,
        maxConcurrencyPerEnvironment: 64,
        environmentVariables: { NODE_ENV: "production" },
      },
    });
    revision.node.addDependency(upload);
    if (codeBucket.policy) {
      revision.node.addDependency(codeBucket.policy);
    }

    // 6) Endpoint: only reachable via IAM; CloudFront signs for us later
    const endpoint = new lambda.CfnWebFunctionEndpoint(this, "Endpoint", {
      functionName: webFunction.ref,
      endpointName: ENDPOINT_NAME,
      endpointType: "HomeRegion",
      authType: "IamAuth",
      revisionWeights: [{ revisionId: revision.attrRevisionId, weight: 100 }],
      throttleConfig: { rateLimit: 200 },
      scalingConfig: { maxEnvironments: 10 },
    });

    // 7) Origin Access Control of type "lambda" with always-amz-auth
    const oac = new cloudfront.CfnOriginAccessControl(this, "WebFunctionOac", {
      originAccessControlConfig: {
        name: `${FUNCTION_NAME}-oac`,
        originAccessControlOriginType: "lambda",
        signingBehavior: "always-amz-auth",
        signingProtocol: "sigv4",
      },
    });

    // 8) Put CloudFront in front of the endpoint
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: new origins.HttpOrigin(endpoint.attrDomainName, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        // Important: do NOT forward the Host header, otherwise the endpoint responds with 404
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
    });

    // The L2 construct doesn't know OAC for Web Functions (yet) -> escape hatch
    const cfnDistribution = distribution.node.defaultChild as cloudfront.CfnDistribution;
    cfnDistribution.addPropertyOverride(
      "DistributionConfig.Origins.0.OriginAccessControlId",
      oac.attrId,
    );

    // 9) Only this distribution may invoke the endpoint
    new lambda.CfnResourcePolicy(this, "AllowCloudFront", {
      resourceArn: webFunction.attrFunctionArn,
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "AllowCloudFrontOACAccess",
            Effect: "Allow",
            Principal: { Service: "cloudfront.amazonaws.com" },
            Action: "lambda:InvokeWebFunctionEndpoint",
            Resource: endpoint.attrEndpointArn,
            Condition: {
              StringEquals: {
                "aws:SourceArn": `arn:${this.partition}:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
              },
            },
          },
        ],
      },
    });

    new CfnOutput(this, "CloudFrontUrl", { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, "EndpointDomain", { value: endpoint.attrDomainName });
  }
}
