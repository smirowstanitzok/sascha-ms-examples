// bin/app.ts
import { App } from "aws-cdk-lib";
import { CinemaFlagsStack } from "../lib/cinema-flags-stack";

const app = new App();
new CinemaFlagsStack(app, "CinemaFlagsStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "eu-central-1",
  },
});
