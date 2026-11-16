// bin/app.ts
import * as cdk from 'aws-cdk-lib';
import { AdvisorStreamStack } from '../lib/advisor-stream-stack.js';

const app = new cdk.App();
new AdvisorStreamStack(app, 'AdvisorStreamStack', {
  env: { region: 'eu-central-1' },
});
