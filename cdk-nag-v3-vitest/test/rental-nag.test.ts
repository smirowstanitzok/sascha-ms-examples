// test/rental-nag.test.ts
import { App, Duration, Stack, Validations } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { AwsSolutionsChecks, ServerlessChecks } from 'cdk-nag';
import { describe, expect, test } from 'vitest';
import { RentalChecks } from '../lib/rental-rules';
import { RentalStack } from '../lib/rental-stack';
import { findings } from './helpers';

function buildStack(): Stack {
  return new RentalStack(new App(), 'BikeRental');
}

describe('cdk-nag rules for the bike rental', () => {
  test('AwsSolutions reports no open violations', () => {
    expect(findings(new AwsSolutionsChecks(), buildStack())).toEqual([]);
  });

  test('Serverless pack reports neither errors nor warnings', () => {
    expect(findings(new ServerlessChecks(), buildStack())).toEqual([]);
  });

  test('custom house rules are satisfied', () => {
    expect(findings(new RentalChecks(), buildStack())).toEqual([]);
  });

  test('every acknowledgment has a real reason', () => {
    const stack = buildStack();
    const reasons: Array<[string, string]> = [];
    for (const construct of stack.node.findAll()) {
      for (const entry of construct.node.metadata) {
        if (entry.type !== Validations.ACKNOWLEDGED_RULES_METADATA_KEY) continue;
        for (const [rule, reason] of Object.entries(entry.data as Record<string, string>)) {
          if (rule.includes('AwsSolutions') || rule.includes('RentalChecks')) {
            reasons.push([rule, reason]);
          }
        }
      }
    }
    expect(reasons.length).toBeGreaterThan(0);
    for (const [, reason] of reasons) {
      expect(reason.length).toBeGreaterThanOrEqual(30);
    }
  });
});

describe('the rules really fire', () => {
  test('queue without dead-letter queue is caught by SQS3', () => {
    const stack = new Stack(new App(), 'Broken');
    new sqs.Queue(stack, 'Loose', { enforceSSL: true });

    const rules = findings(new AwsSolutionsChecks(), stack).map((f) => f.rule);
    expect(rules).toContain('AwsSolutions-SQS3');
  });

  test('timeout above 30 seconds violates the house rule', () => {
    const stack = new Stack(new App(), 'Slow');
    new lambda.Function(stack, 'SlowHandler', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => {};'),
      timeout: Duration.seconds(60),
    });

    expect(findings(new RentalChecks(), stack)).toEqual([
      expect.objectContaining({ rule: 'RentalChecks-L1', path: 'Slow/SlowHandler/Resource' }),
    ]);
  });
});

test('synth with all plugins succeeds', () => {
  const app = new App();
  new RentalStack(app, 'BikeRental');
  Validations.of(app).addPlugins(
    new AwsSolutionsChecks(app),
    new ServerlessChecks(app),
    new RentalChecks(app),
  );
  expect(() => app.synth()).not.toThrow();
});
