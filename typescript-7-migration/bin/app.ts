// bin/app.ts
import { App } from 'aws-cdk-lib';
import { RentalStack } from '../lib/rental-stack';

const app = new App();
new RentalStack(app, 'BikeRentalStack');
