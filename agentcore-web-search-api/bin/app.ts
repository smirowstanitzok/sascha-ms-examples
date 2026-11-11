// bin/app.ts
import { App } from "aws-cdk-lib";
import { ResearchAssistantStack } from "../lib/research-stack";

const app = new App();
const modelId =
  app.node.tryGetContext("modelId") ?? "eu.anthropic.claude-haiku-4-5-20251001-v1:0";

new ResearchAssistantStack(app, "ResearchAssistant", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "eu-west-1" },
  modelId,
  trustedDomains: ["aws.amazon.com", "nodejs.org", "typescriptlang.org", "github.blog"],
});
