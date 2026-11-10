// test/helpers.ts
import type { NagPack } from 'cdk-nag';
import type { IConstruct } from 'constructs';

export interface Finding {
  rule: string;
  severity: string;
  path: string;
}

/** Runs a rule pack and returns all violations as a flat list. */
export function findings(pack: NagPack, scope: IConstruct): Finding[] {
  const report = pack.validateScope(scope);
  return report.violations.flatMap((v) =>
    v.violatingResources.map((r) => ({
      rule: v.ruleName,
      severity: v.severity ?? 'error',
      path: r.constructPath ?? r.resourceLogicalId ?? '?',
    })),
  );
}
