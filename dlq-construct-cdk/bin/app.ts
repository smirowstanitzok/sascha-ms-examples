// bin/app.ts
import { App } from 'aws-cdk-lib';
import { RentalReturnsStack } from '../lib/rental-stack.js';

const app = new App();
new RentalReturnsStack(app, 'RentalReturnsStack');
