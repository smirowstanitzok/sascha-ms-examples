// test/stack.test.ts
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { ResearchAssistantStack } from "../lib/research-stack";

describe("ResearchAssistantStack", () => {
  const app = new App();
  const stack = new ResearchAssistantStack(app, "TestStack", {
    env: { account: "111122223333", region: "eu-west-1" },
    modelId: "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
    trustedDomains: ["aws.amazon.com", "nodejs.org"],
  });
  const template = Template.fromStack(stack);

  it("allows only the AWS managed search tool", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "bedrock-agentcore:InvokeWebSearch",
            Resource: {
              "Fn::Join": ["", ["arn:", { Ref: "AWS::Partition" }, ":bedrock-agentcore:eu-west-1:aws:tool/web-search.v1"]],
            },
          }),
        ]),
      },
    });
  });

  it("passes the trusted domains to the function", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs24.x",
      Architectures: ["arm64"],
      Environment: { Variables: Match.objectLike({ TRUSTED_DOMAINS: "aws.amazon.com,nodejs.org" }) },
    });
  });

  it("sets a log retention", () => {
    template.hasResourceProperties("AWS::Logs::LogGroup", { RetentionInDays: 14 });
    expect(template.findResources("AWS::Lambda::Function")).toBeDefined();
  });
});
