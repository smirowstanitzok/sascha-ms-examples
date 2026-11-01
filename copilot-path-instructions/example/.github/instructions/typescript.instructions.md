---
applyTo: "**/*.ts"
---
# TypeScript

- No `any`. Use `unknown` and narrow the type.
- Validate external input (API events, queue messages) with zod before using it.
- Use named exports, no default exports.
- Use async/await instead of `.then()` chains.
