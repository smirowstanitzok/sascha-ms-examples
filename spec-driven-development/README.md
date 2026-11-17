# Spec-driven development with AI: Spec Kit in practice

The result of a small spec-driven development run with GitHub Spec Kit for a fictional bike rental: a reservation holds a bike for a limited time and expires automatically. The tests map one to one to the acceptance scenarios in the spec, the domain logic is plain TypeScript without AWS calls.

- Article (English): [Spec-driven development with AI: Spec Kit in practice](https://sascha-ms.de/en/spec-driven-development-ai)
- Article (German): [Spec-Driven Development mit KI: Spec Kit in der Praxis](https://sascha-ms.de/2026/3491-spec-driven-development-ki)

## Files

| File | Purpose |
| --- | --- |
| `specs/constitution.md` | Project principles (shortened version from the article) |
| `specs/001-reservation-expiry/spec.md` | Feature spec with user story, requirements and acceptance scenarios |
| `specs/001-reservation-expiry/tasks.md` | Excerpt of the task list generated from the plan |
| `src/reservation.ts` | Domain logic: create a reservation, pick up, effective status with expiry |
| `test/reservation.test.ts` | Vitest tests, one per acceptance scenario |

## Run it

```bash
npm install
npm run typecheck
npm test
```

To try the workflow yourself, install the Spec Kit CLI (`uv tool install specify-cli`) and run `specify init --here --integration claude` in a fresh repository. The article walks through `/speckit-constitution`, `/speckit-specify`, `/speckit-clarify`, `/speckit-plan`, `/speckit-tasks` and `/speckit-implement`.

## Tested with

Node.js 22, TypeScript 5.9, Vitest 3 (type check and 4 tests passed).
