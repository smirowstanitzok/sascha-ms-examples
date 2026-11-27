# Problem details for HTTP APIs (RFC 9457) with AWS Lambda

Example code for the article:

- English: [Problem Details for HTTP APIs: RFC 9457 with Lambda](https://sascha-ms.de/en/problem-details-http-apis-rfc-9457-lambda)
- German: [RFC 9457 Problem Details: API-Fehler einheitlich mit Lambda](https://sascha-ms.de/2026/4226-rfc-9457-problem-details-lambda)

A small bike rental API that returns all errors as `application/problem+json`:
expected errors via a typed Result and a catalog of problem types, failures as a
`500` with `about:blank` and no internal details, unknown routes as a `404` via the
`$default` route.

## Files

| File | Purpose |
| --- | --- |
| `src/result.ts` | Minimal Result type with `assertNever` |
| `src/errors.ts` | Error kinds of the reservation logic |
| `src/reservation.ts` | Input validation (all issues as JSON Pointers) and business rules |
| `src/repository.ts` | In-memory repository for the example |
| `src/problem.ts` | Problem type catalog, `toProblem`, `internalProblem`, `problemResponse` |
| `src/handler.ts` | Lambda handler for `POST /reservations` |
| `src/docs.ts` | HTML documentation behind every type URI |
| `src/not-found.ts` | Catch-all 404 for the `$default` route |
| `src/client.ts` | How a client evaluates a problem response |
| `test/problem.test.ts` | Tests with the Node.js test runner |
| `serverless.yml` | Deployment with Serverless Framework v4 |

## Run

```bash
npm install
npm run typecheck
npm test
```

Deploy (optional, needs an AWS account):

```bash
serverless deploy
serverless remove
```

Set `PROBLEM_BASE_URL` in `serverless.yml` to a domain you own.

Tested with Node.js 22.23 / 24, TypeScript 7.0.2, @types/aws-lambda 8.10.164.
