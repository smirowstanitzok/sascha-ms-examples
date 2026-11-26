// lib/upload-stack.ts
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { CorsHttpMethod, HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { AttributeType, Billing, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

const here = path.dirname(fileURLToPath(import.meta.url));

export interface UploadStackProps extends StackProps {
  // Origin of the web app that may upload, e.g. https://archive.example.org
  allowedOrigin: string;
}

export class AudiobookUploadStack extends Stack {
  constructor(scope: Construct, id: string, props: UploadStackProps) {
    super(scope, id, props);

    const bucket = new Bucket(this, "AudiobookBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      cors: [
        {
          allowedOrigins: [props.allowedOrigin],
          allowedMethods: [HttpMethods.PUT],
          allowedHeaders: ["*"],
          // Without ETag in the CORS header the browser cannot read it from the UploadPart response
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        // Remove abandoned uploads after one day, otherwise the parts keep costing money
        { abortIncompleteMultipartUploadAfter: Duration.days(1) },
      ],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const table = new TableV2(this, "UploadTable", {
      partitionKey: { name: "id", type: AttributeType.STRING },
      billing: Billing.onDemand(),
      timeToLiveAttribute: "expiresAt",
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const fn = (name: string, handler: string) =>
      new NodejsFunction(this, name, {
        entry: path.join(here, "../src/index.ts"),
        handler,
        runtime: Runtime.NODEJS_24_X,
        architecture: Architecture.ARM_64,
        memorySize: 256,
        timeout: Duration.seconds(10),
        environment: { BUCKET_NAME: bucket.bucketName, TABLE_NAME: table.tableName },
        // Bundle the SDK so the tested version runs, not the one from the runtime
        bundling: { externalModules: [], minify: true },
      });

    const startFn = fn("StartUpload", "start");
    const partsFn = fn("SignParts", "signParts");
    const completeFn = fn("CompleteUpload", "complete");
    const abortFn = fn("AbortUpload", "abort");

    // Least privilege: each function only gets what it really needs
    const objects = bucket.arnForObjects("uploads/*");
    startFn.addToRolePolicy(new PolicyStatement({ actions: ["s3:PutObject"], resources: [objects] }));
    partsFn.addToRolePolicy(new PolicyStatement({ actions: ["s3:PutObject"], resources: [objects] }));
    completeFn.addToRolePolicy(
      new PolicyStatement({
        actions: ["s3:PutObject", "s3:ListMultipartUploadParts"],
        resources: [objects],
      }),
    );
    abortFn.addToRolePolicy(
      new PolicyStatement({ actions: ["s3:AbortMultipartUpload"], resources: [objects] }),
    );
    table.grantReadWriteData(startFn);
    table.grantReadData(partsFn);
    table.grantReadWriteData(completeFn);
    table.grantReadWriteData(abortFn);

    const api = new HttpApi(this, "UploadApi", {
      corsPreflight: {
        allowOrigins: [props.allowedOrigin],
        allowMethods: [CorsHttpMethod.POST, CorsHttpMethod.DELETE],
        allowHeaders: ["content-type", "authorization"],
      },
    });
    const route = (p: string, method: HttpMethod, target: NodejsFunction) =>
      api.addRoutes({
        path: p,
        methods: [method],
        integration: new HttpLambdaIntegration(`${target.node.id}Integration`, target),
      });

    route("/uploads", HttpMethod.POST, startFn);
    route("/uploads/{id}/parts", HttpMethod.POST, partsFn);
    route("/uploads/{id}/complete", HttpMethod.POST, completeFn);
    route("/uploads/{id}", HttpMethod.DELETE, abortFn);

    new CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
    new CfnOutput(this, "BucketName", { value: bucket.bucketName });
  }
}
