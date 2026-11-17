# Constitution: bike rental backend

## Principles
1. Serverless first: AWS Lambda, API Gateway (HTTP API), DynamoDB.
   New containers or servers only with an architecture decision record.
2. TypeScript in strict mode, no any types in business logic.
3. Every business rule from the spec has at least one test
   whose name contains the rule ID (for example FR-003).
4. Lambda handlers stay thin: business logic lives in pure functions.
5. No personal data in logs.
6. Infrastructure as code with the Serverless Framework.
