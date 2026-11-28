// bin/app.ts
import { App } from 'aws-cdk-lib';
import { BoatRentalStack } from '../lib/boat-rental-stack.js';

const app = new App();
new BoatRentalStack(app, 'BoatRentalCanaryStack');
