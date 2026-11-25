// bin/app.ts
import { App } from 'aws-cdk-lib';
import { LibrarySearchStack } from '../lib/library-search-stack';

const app = new App();
// AI Security is not available in Frankfurt (as of 2026-11-25) – Stockholm is the EU Region of choice
new LibrarySearchStack(app, 'LibrarySearchStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'eu-north-1' },
});
