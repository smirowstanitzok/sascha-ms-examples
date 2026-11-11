// test/rental-stack.test.ts
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, it } from 'vitest';
import { RentalStack } from '../lib/rental-stack';

describe('RentalStack', () => {
  it('creates a Node.js 24 function on ARM', () => {
    const template = Template.fromStack(new RentalStack(new App(), 'TestStack'));
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
    });
  });
});
