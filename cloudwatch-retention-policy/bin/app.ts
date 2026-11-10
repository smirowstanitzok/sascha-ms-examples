// bin/app.ts
import { App } from "aws-cdk-lib";
import { LogRetentionStack } from "../lib/log-retention-stack.js";

const app = new App();
new LogRetentionStack(app, "LogRetentionStack");
