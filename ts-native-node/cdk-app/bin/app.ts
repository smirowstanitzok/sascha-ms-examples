// bin/app.ts
import { App, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';

class RentalQueueStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    new Queue(this, 'ReturnedBikes', { visibilityTimeout: Duration.seconds(60) });
  }
}

const app = new App();
new RentalQueueStack(app, 'BikeRentalQueueStack');
