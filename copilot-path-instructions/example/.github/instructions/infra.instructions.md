---
applyTo: "infra/**/*.ts"
---
# AWS CDK

- Use L2 constructs. Use L1 (`Cfn*`) only with a comment explaining why.
- Every Lambda function uses `NodejsFunction`, ARM64 and a log group with retention.
- Grant permissions with `grant*` methods instead of hand-written IAM policies.
- Stateful resources (tables, buckets) get `RemovalPolicy.RETAIN`.
