// bin/app.ts
import { App } from "aws-cdk-lib";
import { AudiobookUploadStack } from "../lib/upload-stack.js";

const app = new App();
new AudiobookUploadStack(app, "AudiobookUploadStack", {
  allowedOrigin: app.node.tryGetContext("allowedOrigin") ?? "http://localhost:5173",
});
