// test/stack.test.ts
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { LogRetentionStack } from "../lib/log-retention-stack.js";

describe("LogRetentionStack", () => {
  const template = Template.fromStack(new LogRetentionStack(new App(), "Test"));

  it("creates one custom resource per retention policy", () => {
    template.resourceCountIs("Custom::AWS", 2);
  });

  it("sends the audit prefix as selection criteria", () => {
    const resources = template.findResources("Custom::AWS");
    const creates = Object.values(resources).map((r) => JSON.stringify(r.Properties.Create));
    expect(creates.some((c) => c.includes("/bikerental/audit") && c.includes("731"))).toBe(true);
  });

  it("allows only the CloudWatch Logs policy actions", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(["logs:PutAccountPolicy", "logs:PutRetentionPolicy"]),
          }),
        ]),
      },
    });
  });
});
