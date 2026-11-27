// infra/app.ts
import { App } from 'aws-cdk-lib';
import { PowerTunerStack } from './tuner-stack.ts';

const app = new App();
new PowerTunerStack(app, 'PowerTuner', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'eu-central-1' },
  functionPrefix: 'bakery-export-',
});
