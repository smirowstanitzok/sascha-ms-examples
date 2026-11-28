// test/stack.test.ts
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { BoatRentalStack } from '../lib/boat-rental-stack.js';

describe('BoatRentalStack', () => {
  const template = Template.fromStack(new BoatRentalStack(new App(), 'TestStack'));

  it('uses a canary deployment with alarm-based rollback', () => {
    template.hasResourceProperties('AWS::CodeDeploy::DeploymentGroup', {
      DeploymentConfigName: 'CodeDeployDefault.LambdaCanary10Percent5Minutes',
      AutoRollbackConfiguration: {
        Enabled: true,
        Events: Match.arrayWith(['DEPLOYMENT_STOP_ON_ALARM']),
      },
    });
  });

  it('lets CodeDeploy manage the alias and run the pre-traffic hook', () => {
    const aliases = template.findResources('AWS::Lambda::Alias');
    const alias = Object.values(aliases)[0] as { UpdatePolicy?: Record<string, unknown> };
    expect(alias.UpdatePolicy).toHaveProperty('CodeDeployLambdaAliasUpdate.BeforeAllowTrafficHook');
  });
});
