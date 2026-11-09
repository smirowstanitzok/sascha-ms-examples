# Bike rental: guidance for Copilot

This repository contains a bike rental service on AWS: Lambda handlers in TypeScript under `services/`, infrastructure with AWS CDK under `infra/`.

- Node.js 22, TypeScript in strict mode, ES modules.
- Build: `npm run build`, tests: `npm test`, lint: `npm run lint`.
- Never put secrets, account IDs or real customer data in code or tests.
- Prefer small, pure functions and keep AWS SDK calls at the edges.
