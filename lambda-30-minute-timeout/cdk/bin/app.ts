// cdk/bin/app.ts
import { App } from 'aws-cdk-lib';
import { PhotoBookStack } from '../lib/photo-book-stack.ts';

const app = new App();
new PhotoBookStack(app, 'PhotoBookRenderer', {
  env: { region: process.env.CDK_DEFAULT_REGION ?? 'eu-central-1' },
});
