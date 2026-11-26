// test/stack.test.ts
// Checks the synthesized CloudFormation template with the CDK assertions.
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { AudiobookUploadStack } from "../lib/upload-stack.js";

const template = Template.fromStack(
  new AudiobookUploadStack(new App(), "TestStack", { allowedOrigin: "https://archive.example.org" }),
);

describe("AudiobookUploadStack", () => {
  it("aborts incomplete multipart uploads after one day", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      LifecycleConfiguration: {
        Rules: Match.arrayWith([Match.objectLike({ AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 } })]),
      },
    });
  });

  it("exposes the ETag header via CORS for the web app origin only", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      CorsConfiguration: {
        CorsRules: [Match.objectLike({ AllowedOrigins: ["https://archive.example.org"], ExposedHeaders: ["ETag"] })],
      },
    });
  });

  it("creates four Lambda functions and four routes", () => {
    const fns = template.findResources("AWS::Lambda::Function", { Properties: { Runtime: "nodejs24.x" } });
    expect(Object.keys(fns)).toHaveLength(4);
    template.resourceCountIs("AWS::ApiGatewayV2::Route", 4);
  });
});
