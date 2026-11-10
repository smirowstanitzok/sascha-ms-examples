// lib/log-retention-stack.ts
// CloudFormation's AWS::Logs::AccountPolicy does not list RETENTION_POLICY yet,
// so this stack calls the CloudWatch Logs API through an AwsCustomResource.
import { Stack, type StackProps } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

export interface RetentionRule {
  /** Unique policy name, must not start with "aws/". */
  name: string;
  /** Log group name prefix; leave empty for all log groups. */
  prefix?: string;
  /** 30, 60, 90, ... 3653 or "NEVER_EXPIRE". */
  retention: number | "NEVER_EXPIRE";
  mode?: "RETROACTIVE" | "NEW_ONLY";
}

export class AccountRetentionPolicy extends Construct {
  constructor(scope: Construct, id: string, rule: RetentionRule) {
    super(scope, id);

    const params: Record<string, string> = {
      policyName: rule.name,
      policyType: "RETENTION_POLICY",
      policyDocument: JSON.stringify({
        retentionInDays: rule.retention,
        enforcementMode: rule.mode ?? "RETROACTIVE",
      }),
    };
    if (rule.prefix) {
      params.selectionCriteria = `LogGroupNamePrefix="${rule.prefix}"`;
    }

    const putCall = {
      service: "CloudWatchLogs",
      action: "putAccountPolicy",
      parameters: params,
      physicalResourceId: PhysicalResourceId.of(`retention-${rule.name}`),
    };

    new AwsCustomResource(this, "Policy", {
      onCreate: putCall,
      onUpdate: putCall,
      onDelete: {
        service: "CloudWatchLogs",
        action: "deleteAccountPolicy",
        parameters: { policyName: rule.name, policyType: "RETENTION_POLICY" },
      },
      policy: AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: [
            "logs:PutAccountPolicy",
            "logs:PutRetentionPolicy",
            "logs:DeleteAccountPolicy",
            "logs:DeleteRetentionPolicy",
          ],
          resources: ["*"],
        }),
      ]),
      installLatestAwsSdk: false,
    });
  }
}

export class LogRetentionStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Baseline for everything in this account and region.
    new AccountRetentionPolicy(this, "Baseline", { name: "baseline-90d", retention: 90 });

    // Longer retention for audit logs of the fictional bike rental.
    new AccountRetentionPolicy(this, "Audit", {
      name: "audit-2y",
      prefix: "/bikerental/audit",
      retention: 731,
    });
  }
}
