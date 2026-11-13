# Migrate Jest to Vitest

Example project for the article **Migrate Jest to Vitest: move TypeScript tests over**.

- English article: https://sascha-ms.de/en/migrate-jest-to-vitest
- German article: https://sascha-ms.de/2026/2863-jest-zu-vitest-migrieren/

A small, fictional city library service with two Lambda handlers in TypeScript. The tests were moved from Jest + ts-jest to Vitest 5, so the project works with TypeScript 7.

## Files

| Path | Purpose |
| --- | --- |
| `src/ausleihe.ts` | Lambda handler: creates a loan in DynamoDB (409 if the book is already on loan) |
| `src/mahnlauf.ts` | Sends reminders for overdue loans |
| `src/leihfrist.ts` | Loan period helpers (28 days) |
| `src/erinnerung.ts` | Reminder placeholder (default export) |
| `test/*.test.ts` | Vitest tests: fake timers, aws-sdk-client-mock, module mocks |
| `test/setup.ts` | Registers the aws-sdk-client-mock-vitest matchers |
| `scripts/jest-check.mjs` | Finds Jest-specific code that needs manual work before migrating |
| `vitest.config.ts`, `tsconfig.json` | Configuration |

## Run

```bash
npm install
npm run check:jest
npm run typecheck
npm test
npm run coverage
```

Run the check script against your own Jest project:

```bash
node scripts/jest-check.mjs path/to/your/tests
```

## Tested with

Node.js 22.23, Vitest 5.1.0, TypeScript 7.0.2, aws-sdk-client-mock 4.1.0, aws-sdk-client-mock-vitest 8.0.0 (November 2026).
