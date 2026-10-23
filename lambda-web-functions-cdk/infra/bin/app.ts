#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { WebAppStack } from "../lib/web-app-stack";

const app = new App();
new WebAppStack(app, "HalloWebStack", {
  // In the EU, Web Functions are currently only available in Ireland
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "eu-west-1" },
});
