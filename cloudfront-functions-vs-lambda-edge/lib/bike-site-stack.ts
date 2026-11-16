// lib/bike-site-stack.ts
import * as path from 'node:path';
import { CfnOutput, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';

export class BikeSiteStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });
    const siteOrigin = origins.S3BucketOrigin.withOriginAccessControl(siteBucket);

    // CloudFront Function with KeyValueStore for redirects and pretty URLs
    const redirectStore = new cloudfront.KeyValueStore(this, 'RedirectStore', {
      source: cloudfront.ImportSource.fromAsset(path.join(process.cwd(), 'redirects.json'))
    });
    const redirectFunction = new cloudfront.Function(this, 'RedirectFunction', {
      code: cloudfront.FunctionCode.fromFile({
        filePath: path.join(process.cwd(), 'functions/redirects.js')
      }),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      keyValueStore: redirectStore,
      comment: 'Redirects and pretty URLs'
    });

    // Lambda@Edge for the members area; CDK places it in us-east-1 automatically
    const memberAuth = new cloudfront.experimental.EdgeFunction(this, 'MemberAuth', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(process.cwd(), 'dist/member-auth')),
      memorySize: 128
    });

    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: siteOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [
          { function: redirectFunction, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }
        ]
      },
      additionalBehaviors: {
        '/mitglieder/*': {
          origin: siteOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
          edgeLambdas: [
            {
              functionVersion: memberAuth.currentVersion,
              eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST
            }
          ]
        }
      }
    });

    new s3deploy.BucketDeployment(this, 'DeploySite', {
      sources: [s3deploy.Source.asset(path.join(process.cwd(), 'site'))],
      destinationBucket: siteBucket,
      distribution
    });

    new CfnOutput(this, 'Url', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'RedirectFunctionName', { value: redirectFunction.functionName });
  }
}
