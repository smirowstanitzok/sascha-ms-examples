# Code examples from sascha-ms.de

Tested, runnable code from the articles on **[sascha-ms.de](https://sascha-ms.de/en/)**, my blog about AI in everyday development, serverless on AWS, TypeScript and leadership.

Every folder is a small, self-contained project with its own `README.md`, `package.json` and tests where it makes sense. The code was checked when the article was written (type check, tests, `cdk synth`), never against production systems.

| Example | Topic | Article |
| --- | --- | --- |
| [`agentcore-web-search-api`](./agentcore-web-search-api) | Amazon Bedrock AgentCore · Lambda · AWS CDK · TypeScript | [AgentCore Web Search API: web search without a gateway](https://sascha-ms.de/en/agentcore-web-search-api) · [DE](https://sascha-ms.de/2026/2659-agentcore-web-search-api) |
| [`sqs-dlq-redrive`](./sqs-dlq-redrive) | Serverless · SQS · Serverless Framework · TypeScript | [SQS dead-letter queue: alarm, triage and redrive](https://sascha-ms.de/en/sqs-dead-letter-queue-redrive) · [DE](https://sascha-ms.de/2026/2646-sqs-dead-letter-queue-redrive) |
| [`actions-log-secret-scan`](./actions-log-secret-scan) | GitHub Actions · Secret scanning · Vitest · TypeScript | [Secrets in GitHub Actions logs: find and prevent leaks](https://sascha-ms.de/en/secrets-github-actions-logs) · [DE](https://sascha-ms.de/2026/2621-github-actions-logs-secrets) |
| [`claude-fable-5-2-migration`](./claude-fable-5-2-migration) | Claude API · Anthropic SDK · Vitest · TypeScript | [Claude Fable 5.2 migration for TypeScript backends](https://sascha-ms.de/en/claude-fable-5-2-migration-typescript) · [DE](https://sascha-ms.de/2026/2564-claude-fable-5-2-migration) |
| [`cdk-nag-v3-vitest`](./cdk-nag-v3-vitest) | AWS CDK · cdk-nag · Vitest · TypeScript | [cdk-nag v3: Security Checks in CDK Tests with Vitest](https://sascha-ms.de/en/cdk-nag-v3-vitest) · [DE](https://sascha-ms.de/2026/2554-cdk-nag-v3-vitest) |
| [`dynamodb-transactions`](./dynamodb-transactions) | DynamoDB · Lambda · Serverless Framework · TypeScript | [DynamoDB transactions: TransactWriteItems with Lambda](https://sascha-ms.de/en/dynamodb-transactions-transactwriteitems-lambda) · [DE](https://sascha-ms.de/2026/2541-dynamodb-transaktionen) |
| [`cloudwatch-retention-policy`](./cloudwatch-retention-policy) | CloudWatch Logs · AWS CDK · TypeScript | [CloudWatch Logs retention policy for the whole account](https://sascha-ms.de/en/cloudwatch-logs-retention-policy) · [DE](https://sascha-ms.de/2026/2527-cloudwatch-logs-aufbewahrung) |
| [`dynamodb-optimistic-locking`](./dynamodb-optimistic-locking) | DynamoDB · AWS CDK · TypeScript | [DynamoDB optimistic locking: version numbers with Lambda](https://sascha-ms.de/en/dynamodb-optimistic-locking) · [DE](https://sascha-ms.de/2026/2473-dynamodb-optimistic-locking) |
| [`serverless-template-tests`](./serverless-template-tests) | Serverless Framework · Vitest · CloudFormation | [Testing the Serverless Framework with Vitest](https://sascha-ms.de/en/testing-serverless-framework-vitest) · [DE](https://sascha-ms.de/2026/2460-serverless-framework-testen) |
| [`secrets-manager-rotation`](./secrets-manager-rotation) | AWS Lambda · Secrets Manager · Serverless Framework | [Secrets Manager Rotation with Lambda for API Keys](https://sascha-ms.de/en/secrets-manager-rotation-lambda-api-keys) · [DE](https://sascha-ms.de/2026/1724-secrets-manager-rotation-lambda) |
| [`webhook-receiver-lambda`](./webhook-receiver-lambda) | Lambda · DynamoDB · SQS · CDK | [Receiving webhooks with Lambda: signatures, duplicates, SQS](https://sascha-ms.de/en/receiving-webhooks-lambda) · [DE](https://sascha-ms.de/2026/1574-webhooks-empfangen-lambda) |
| [`human-approval-step-functions`](./human-approval-step-functions) | Step Functions · AI agents · TypeScript | [Human in the loop for AI agents with Step Functions](https://sascha-ms.de/en/human-loop-ai-agents-step-functions) · [DE](https://sascha-ms.de/2026/1608-human-in-the-loop-step-functions) |
| [`lambda-parameter-store`](./lambda-parameter-store) | Lambda · Parameter Store · Serverless Framework | [Parameter Store in Lambda: loading config the right way](https://sascha-ms.de/en/parameter-store-lambda-configuration) · [DE](https://sascha-ms.de/2026/1686-parameter-store-lambda) |
| [`claude-api-2026-10-21-migration`](./claude-api-2026-10-21-migration) | AI · TypeScript | [Claude API 2026-10-21: Migrating to the New SDK](https://sascha-ms.de/en/claude-api-2026-10-21-migration-new-sdk) · [DE](https://sascha-ms.de/2026/352-claude-api-2026-10-21-migration) |
| [`secure-mcp-servers`](./secure-mcp-servers) | AI · Security · TypeScript | [Connecting MCP Servers Securely: Lessons from OpenCode](https://sascha-ms.de/en/secure-mcp-servers-opencode-lessons) · [DE](https://sascha-ms.de/2026/358-mcp-server-sicher-anbinden-opencode) |
| [`claude-code-hooks-guardrails`](./claude-code-hooks-guardrails) | AI · Claude Code | [Claude Code Hooks: Guardrails for Your AI Agent](https://sascha-ms.de/en/claude-code-hooks-guardrails) · [DE](https://sascha-ms.de/2026/213-claude-code-hooks-leitplanken) |
| [`lambda-web-functions-cdk`](./lambda-web-functions-cdk) | AWS Lambda · CDK · CloudFront | [Lambda Web Functions: Express App With CDK & CloudFront](https://sascha-ms.de/en/lambda-web-functions-cdk-cloudfront) · [DE](https://sascha-ms.de/2026/208-lambda-web-functions-cdk-cloudfront) |
| [`dynamodb-streams-replay`](./dynamodb-streams-replay) | DynamoDB · Lambda · CDK | [DynamoDB Streams AT_TIMESTAMP: Replay From a Point in Time](https://sascha-ms.de/en/dynamodb-streams-at-timestamp-replay) · [DE](https://sascha-ms.de/2026/173-dynamodb-streams-at-timestamp-replay) |
| [`typescript-7-1-beta`](./typescript-7-1-beta) | TypeScript | [TypeScript 7.1 Beta: What’s New and How to Test It](https://sascha-ms.de/en/typescript-7-1-beta) · [DE](https://sascha-ms.de/2026/114-typescript-7-1-beta-testen) |
| [`typescript-7-migration`](./typescript-7-migration) | TypeScript 7 · tsconfig · AWS CDK · Serverless Framework · Lambda | [TypeScript 7 migration: Lambda and CDK projects](https://sascha-ms.de/en/typescript-7-migration-lambda-cdk) · [DE](https://sascha-ms.de/2026/2670-typescript-7-migration) |
| [`copilot-path-instructions`](./copilot-path-instructions) | GitHub Copilot | [Path-specific Copilot custom instructions: a guide](https://sascha-ms.de/en/path-specific-copilot-custom-instructions) · [DE](https://sascha-ms.de/2026/1735-copilot-custom-instructions-pro-pfad) |
| [`appconfig-feature-flags-lambda`](./appconfig-feature-flags-lambda) | Serverless · AWS CDK · TypeScript | [AppConfig feature flags in Lambda: safe rollouts](https://sascha-ms.de/en/appconfig-feature-flags-lambda) · [DE](https://sascha-ms.de/2026/1709-appconfig-feature-flags-lambda) |
| [`uv-lambda-layer`](./uv-lambda-layer) | Serverless · Python · Serverless Framework | [uv for AWS Lambda: Packaging Python Dependencies](https://sascha-ms.de/en/uv-aws-lambda-python-dependencies) |
| [`monte-carlo-forecast`](./monte-carlo-forecast) | Agile · Kanban · TypeScript | [Monte Carlo forecasting: delivery dates without story points](https://sascha-ms.de/en/monte-carlo-forecasting-delivery-dates) · [DE](https://sascha-ms.de/2026/2610-monte-carlo-simulation-liefertermine) |

## How to use

```bash
git clone https://github.com/smirowstanitzok/sascha-ms-examples.git
cd sascha-ms-examples/<example>
npm install
npm test
```

You need Node.js 22 or newer. Examples that deploy to AWS create real resources, so check the costs and remove them afterwards (`npx cdk destroy`).

## About

I am Sascha Mirow-Stanitzok, team lead of the Middleware team at freenet Group in Germany and an AWS pioneer with a lot of CDK and Serverless experience. New articles appear on [sascha-ms.de](https://sascha-ms.de/) (German) and [sascha-ms.de/en](https://sascha-ms.de/en/) (English).

Found a bug or have a question? Open an issue or leave a comment under the article.

## License

[MIT](./LICENSE). The article texts on sascha-ms.de are not part of this license.
