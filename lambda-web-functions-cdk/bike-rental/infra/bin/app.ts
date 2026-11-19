#!/usr/bin/env node
// infra/bin/app.ts
import { App } from "aws-cdk-lib";
import { BikeRentalStack } from "../lib/bike-rental-stack";

const app = new App();
new BikeRentalStack(app, "BikeRentalStack", {
  // In the EU, Web Functions are currently only available in Ireland
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "eu-west-1" },
});
