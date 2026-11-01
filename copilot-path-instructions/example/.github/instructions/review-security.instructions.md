---
applyTo: "infra/**/*.ts,services/**/*.ts"
excludeAgent: "cloud-agent"
---
# Review focus: security

- Flag IAM statements with "*" in actions or resources.
- Flag public S3 buckets, open security groups and missing encryption.
- Flag log statements that could contain personal data (names, emails, addresses).
- Do not comment on formatting. Prettier takes care of that.
