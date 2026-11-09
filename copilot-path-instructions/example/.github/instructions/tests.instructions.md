---
applyTo: "**/*.test.ts"
excludeAgent: "code-review"
---
# Tests

- Use vitest with describe/it. Test names describe behavior.
- Mock AWS SDK calls with aws-sdk-client-mock and never call real AWS.
- Put each test file next to its source file.
