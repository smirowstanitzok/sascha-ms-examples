// bin/app.ts
import { App } from 'aws-cdk-lib';
import { BikeReturnStack } from '../lib/bike-return-stack.js';

const app = new App();
new BikeReturnStack(app, 'BikeReturnStack');
