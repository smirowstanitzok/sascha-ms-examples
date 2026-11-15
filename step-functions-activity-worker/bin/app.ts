// bin/app.ts
import { App } from 'aws-cdk-lib';
import { ContractPrintStack } from '../lib/contract-print-stack.js';

const app = new App();
new ContractPrintStack(app, 'ContractPrintStack');
