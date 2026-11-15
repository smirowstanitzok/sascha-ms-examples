// test/stack.test.ts
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { BookshopPicksStack } from "../lib/bookshop-picks-stack.js";

// Skip bundling (no Docker needed in the test)
const app = new App({ context: { "aws:cdk:bundling-stacks": [] } });
const template = Template.fromStack(
  new BookshopPicksStack(app, "TestStack", { cacheName: "bookshop-cache", cacheHost: "example.cache.amazonaws.com", dockerBundling: false }),
);

describe("BookshopPicksStack", () => {
  it("gives the function more time than the lock", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs24.x",
      Timeout: 25,
      Environment: { Variables: Match.objectLike({ CACHE_NAME: "bookshop-cache", FRESH_SECONDS: "600" }) },
    });
  });

  it("allows elasticache:Connect for cache and IAM user", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([Match.objectLike({ Action: "elasticache:Connect" })]),
      },
    });
  });

  it("exposes GET /picks/{genre}", () => {
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: "GET /picks/{genre}" });
  });
});
