// bin/app.ts
import { App } from 'aws-cdk-lib';
import { ClubJobsStack } from '../lib/club-jobs-stack.js';

const app = new App();
new ClubJobsStack(app, 'ClubJobsStack');
