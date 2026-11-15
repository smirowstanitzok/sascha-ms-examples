// bin/app.ts
import { App } from 'aws-cdk-lib';
import { LibraryWebStack } from '../lib/library-web-stack';

const app = new App();
new LibraryWebStack(app, 'LibraryWebStack', {
  env: { region: process.env.CDK_DEFAULT_REGION ?? 'eu-central-1' },
});
