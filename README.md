# Code examples from sascha-ms.de

Tested, runnable code from the articles on **[sascha-ms.de](https://sascha-ms.de/en/)**, my blog about AI in everyday development, serverless on AWS, TypeScript and leadership.

Every folder is a small, self-contained project with its own `README.md`, `package.json` and tests where it makes sense. The code was checked when the article was written (type check, tests, `cdk synth`), never against production systems.

| Example | Topic | Article |
| --- | --- | --- |
| [`webhook-receiver-lambda`](./webhook-receiver-lambda) | Lambda · DynamoDB · SQS · CDK | [Receiving webhooks with Lambda: signatures, duplicates, SQS](https://sascha-ms.de/en/receiving-webhooks-lambda) · [DE](https://sascha-ms.de/2026/1574-webhooks-empfangen-lambda) |
| [`claude-api-2026-10-21-migration`](./claude-api-2026-10-21-migration) | AI · TypeScript | [Claude API 2026-10-21: Migrating to the New SDK](https://sascha-ms.de/en/claude-api-2026-10-21-migration-new-sdk) · [DE](https://sascha-ms.de/2026/352-claude-api-2026-10-21-migration) |
| [`secure-mcp-servers`](./secure-mcp-servers) | AI · Security · TypeScript | [Connecting MCP Servers Securely: Lessons from OpenCode](https://sascha-ms.de/en/secure-mcp-servers-opencode-lessons) · [DE](https://sascha-ms.de/2026/358-mcp-server-sicher-anbinden-opencode) |
| [`claude-code-hooks-guardrails`](./claude-code-hooks-guardrails) | AI · Claude Code | [Claude Code Hooks: Guardrails for Your AI Agent](https://sascha-ms.de/en/claude-code-hooks-guardrails) · [DE](https://sascha-ms.de/2026/213-claude-code-hooks-leitplanken) |
| [`lambda-web-functions-cdk`](./lambda-web-functions-cdk) | AWS Lambda · CDK · CloudFront | [Lambda Web Functions: Express App With CDK & CloudFront](https://sascha-ms.de/en/lambda-web-functions-cdk-cloudfront) · [DE](https://sascha-ms.de/2026/208-lambda-web-functions-cdk-cloudfront) |
| [`dynamodb-streams-replay`](./dynamodb-streams-replay) | DynamoDB · Lambda · CDK | [DynamoDB Streams AT_TIMESTAMP: Replay From a Point in Time](https://sascha-ms.de/en/dynamodb-streams-at-timestamp-replay) · [DE](https://sascha-ms.de/2026/173-dynamodb-streams-at-timestamp-replay) |
| [`typescript-7-1-beta`](./typescript-7-1-beta) | TypeScript | [TypeScript 7.1 Beta: What’s New and How to Test It](https://sascha-ms.de/en/typescript-7-1-beta) · [DE](https://sascha-ms.de/2026/114-typescript-7-1-beta-testen) |

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
