// bin/app.ts
import { App } from 'aws-cdk-lib';
import { BikeRentalStack } from '../lib/bike-rental-stack.js';

const app = new App();
new BikeRentalStack(app, 'BikeRentalStack');
