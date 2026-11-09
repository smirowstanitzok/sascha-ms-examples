// test/infrastructure.test.ts
import { describe, expect, it } from 'vitest';
import { STAGES } from './package-stages';
import { loadTemplate, onlyResourceOfType, resourcesOfType } from './template';

describe.each(STAGES)('Stage %s', (stage) => {
  const template = loadTemplate(stage);

  it('uses Node.js 22 and a bounded timeout', () => {
    const fn = template.Resources.StartRentalLambdaFunction;
    expect(fn.Type).toBe('AWS::Lambda::Function');
    expect(fn.Properties?.Runtime).toBe('nodejs22.x');
    expect(fn.Properties?.Timeout).toBeLessThanOrEqual(29);
  });

  it('has a table with point-in-time recovery and on-demand billing', () => {
    const table = onlyResourceOfType(template, 'AWS::DynamoDB::Table');
    expect(table.Properties).toMatchObject({
      BillingMode: 'PAY_PER_REQUEST',
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
    });
  });

  it('routes failed invoices to a dead-letter queue', () => {
    const queue = template.Resources.InvoiceQueue;
    const redrive = queue.Properties?.RedrivePolicy;
    expect(redrive?.deadLetterTargetArn).toEqual({
      'Fn::GetAtt': ['InvoiceDeadLetterQueue', 'Arn'],
    });
    expect(redrive?.maxReceiveCount).toBe(stage === 'prod' ? 5 : 3);
  });

  it('limits log retention to 14 days', () => {
    const logGroups = resourcesOfType(template, 'AWS::Logs::LogGroup');
    expect(logGroups.length).toBeGreaterThan(0);
    for (const [, group] of logGroups) {
      expect(group.Properties?.RetentionInDays).toBe(14);
    }
  });

  it('grants no wildcard permissions in the Lambda role', () => {
    const role = onlyResourceOfType(template, 'AWS::IAM::Role');
    const statements = role.Properties?.Policies.flatMap(
      (policy: any) => policy.PolicyDocument.Statement,
    );
    for (const statement of statements) {
      const actions = [statement.Action].flat();
      expect(actions).not.toContain('*');
      expect(actions.some((a: string) => a.endsWith(':*'))).toBe(false);
    }
  });
});

describe('Differences between stages', () => {
  it('retains the table in prod and removes it in dev', () => {
    const dev = loadTemplate('dev').Resources.RentalsTable;
    const prod = loadTemplate('prod').Resources.RentalsTable;
    expect(prod.DeletionPolicy).toBe('Retain');
    expect(prod.UpdateReplacePolicy).toBe('Retain');
    expect(dev.DeletionPolicy).toBe('Delete');
  });

  it('creates the same resource types in both stages', () => {
    const types = (stage: string) =>
      Object.values(loadTemplate(stage).Resources).map((r) => r.Type).sort();
    expect(types('prod')).toEqual(types('dev'));
    expect(types('dev')).toMatchSnapshot();
  });
});
