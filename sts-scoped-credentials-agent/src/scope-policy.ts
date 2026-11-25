// src/scope-policy.ts
// Builds the scope-down policies we pass to GetScopedCredentials.

export const MAX_POLICY_CHARS = 2048;

// Shop IDs come from the token. We still validate them strictly
// so that nobody can widen the policy with "*" or "/".
const SHOP_ID = /^[a-z0-9-]{3,40}$/;

type Condition = Record<string, Record<string, string | string[]>>;

interface Statement {
  Effect: 'Allow';
  Action?: string[];
  NotAction?: string[];
  Resource: string | string[];
  Condition?: Condition;
}

export interface PolicyDocument {
  Version: '2012-10-17';
  Statement: Statement[];
}

export function assertShopId(shopId: string): void {
  if (!SHOP_ID.test(shopId)) {
    throw new Error(`Invalid shop ID: ${JSON.stringify(shopId)}`);
  }
}

// Tool set for one rental shop: read documents, write damage reports.
export function shopToolPolicy(
  bucket: string,
  shopId: string,
  allowFurtherScoping = false,
): PolicyDocument {
  assertShopId(shopId);
  const prefix = `shops/${shopId}`;
  const statements: Statement[] = [
    {
      Effect: 'Allow',
      Action: ['s3:GetObject'],
      Resource: `arn:aws:s3:::${bucket}/${prefix}/docs/*`,
    },
    {
      Effect: 'Allow',
      Action: ['s3:ListBucket'],
      Resource: `arn:aws:s3:::${bucket}`,
      Condition: { StringLike: { 's3:prefix': [`${prefix}/docs/*`] } },
    },
    {
      Effect: 'Allow',
      Action: ['s3:PutObject'],
      Resource: `arn:aws:s3:::${bucket}/${prefix}/reports/*`,
    },
  ];
  // Only needed if these credentials should be scoped down
  // even further later (for example for a sub-agent).
  if (allowFurtherScoping) {
    statements.push({
      Effect: 'Allow',
      Action: ['sts:GetScopedCredentials'],
      Resource: '*',
    });
  }
  return { Version: '2012-10-17', Statement: statements };
}

// For a sub-agent that only summarizes: read access only.
export function readOnlyPolicy(bucket: string, shopId: string): PolicyDocument {
  assertShopId(shopId);
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['s3:GetObject'],
        Resource: `arn:aws:s3:::${bucket}/shops/${shopId}/docs/*`,
      },
    ],
  };
}

// Deny list: keep the session's permissions, remove dangerous actions.
export function denyListPolicy(extraActions: string[] = []): PolicyDocument {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        NotAction: [
          'iam:*',
          'organizations:*',
          'account:*',
          'sts:AssumeRole*',
          's3:DeleteBucket',
          's3:DeleteObject',
          'dynamodb:DeleteTable',
          ...extraActions,
        ],
        Resource: '*',
      },
    ],
  };
}

export function serializePolicy(policy: PolicyDocument): string {
  const json = JSON.stringify(policy);
  if (json.length > MAX_POLICY_CHARS) {
    throw new Error(
      `Policy has ${json.length} characters, the limit is ${MAX_POLICY_CHARS}`,
    );
  }
  return json;
}
