// bin/app.ts
import { App, Validations } from 'aws-cdk-lib';
import { AwsSolutionsChecks, ServerlessChecks } from 'cdk-nag';
import { RentalChecks } from '../lib/rental-rules';
import { RentalStack } from '../lib/rental-stack';

const app = new App();
new RentalStack(app, 'BikeRental');

// Every check runs automatically on cdk synth and cdk deploy.
Validations.of(app).addPlugins(
  new AwsSolutionsChecks(app),
  new ServerlessChecks(app),
  new RentalChecks(app),
);
