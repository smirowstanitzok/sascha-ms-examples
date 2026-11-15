// bin/app.ts
import { App } from "aws-cdk-lib";
import { BookshopPicksStack } from "../lib/bookshop-picks-stack.js";

const app = new App();
new BookshopPicksStack(app, "BookshopPicksStack", {
  env: { region: process.env.CDK_DEFAULT_REGION ?? "eu-central-1", account: process.env.CDK_DEFAULT_ACCOUNT },
  cacheName: app.node.tryGetContext("cacheName") ?? "bookshop-cache",
  cacheHost: app.node.getContext("cacheHost"),
});
