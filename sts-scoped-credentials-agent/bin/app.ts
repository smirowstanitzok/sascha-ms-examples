// bin/app.ts
import * as cdk from 'aws-cdk-lib';
import { RentalAssistantStack } from '../lib/assistant-stack.ts';

const app = new cdk.App();
new RentalAssistantStack(app, 'RentalAssistantStack');
