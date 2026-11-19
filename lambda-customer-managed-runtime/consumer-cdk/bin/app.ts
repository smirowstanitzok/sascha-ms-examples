// bin/app.ts
import { App } from 'aws-cdk-lib';
import { RentalStack } from '../lib/rental-stack.js';

const app = new App();
const stage = app.node.tryGetContext('stage') ?? 'dev';

new RentalStack(app, `rental-${stage}`, {
  stage,
  runtimeArn:
    app.node.tryGetContext('runtimeArn') ??
    'arn:aws:lambda:eu-central-1:111111111111:runtime/radwerk-node24',
});
