// cdk/bin/app.ts
import { App } from 'aws-cdk-lib';
import { ReceiptsStack } from '../lib/receipts-stack';

const app = new App();
new ReceiptsStack(app, 'BikeRentalReceipts', { env: { region: 'eu-central-1' } });
