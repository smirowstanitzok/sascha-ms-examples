// bin/app.ts
import { App } from 'aws-cdk-lib';
import { TokenExchangeStack } from '../lib/token-exchange-stack.js';

const app = new App();
new TokenExchangeStack(app, 'BuchladenTokenExchange', {
  env: { region: process.env.CDK_DEFAULT_REGION ?? 'eu-central-1' },
});
