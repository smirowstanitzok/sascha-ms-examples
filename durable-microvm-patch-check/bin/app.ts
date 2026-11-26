// bin/app.ts
import { App } from "aws-cdk-lib";
import { PatchCheckStack } from "../lib/patch-check-stack.ts";

const app = new App();
new PatchCheckStack(app, "PatchCheck", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
