---
applyTo: "services/**/src/handlers/**/*.ts"
---
# Lambda handlers

- Create SDK clients outside the handler so they are reused.
- Log with the Powertools Logger as JSON and never log complete events.
- Handlers must be idempotent: the same event may arrive twice.
- Throw only for errors that are worth a retry; return everything else as a typed result.
