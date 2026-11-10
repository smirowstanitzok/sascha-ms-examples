// lib/rental-rules.ts
import { CfnResource } from 'aws-cdk-lib';
import { CfnFunction } from 'aws-cdk-lib/aws-lambda';
import type { IConstruct } from 'constructs';
import {
  NagMessageLevel,
  NagPack,
  type NagPackProps,
  NagRuleCompliance,
  NagRules,
} from 'cdk-nag';

/** Custom house rules for the bike rental. */
export class RentalChecks extends NagPack {
  public readonly name = 'RentalChecks';

  constructor(scope?: IConstruct, props?: NagPackProps) {
    super(scope, props);
    this.packName = 'RentalChecks';
  }

  protected checkResource(node: CfnResource): void {
    this.applyRule({
      ruleSuffixOverride: 'L1',
      info: 'The Lambda function has a timeout above 30 seconds.',
      explanation:
        'Long timeouts hide hanging calls to third-party systems and make failures expensive.',
      level: NagMessageLevel.ERROR,
      rule: (resource: CfnResource) => {
        if (!(resource instanceof CfnFunction)) return NagRuleCompliance.NOT_APPLICABLE;
        const timeout = NagRules.resolveIfPrimitive(resource, resource.timeout) ?? 3;
        return timeout <= 30 ? NagRuleCompliance.COMPLIANT : NagRuleCompliance.NON_COMPLIANT;
      },
      node,
    });
  }
}
