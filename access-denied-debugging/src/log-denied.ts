// src/log-denied.ts
import { extractAuthorizationId, isAccessDenied } from "./authorization-id";

// Logs an AccessDenied error as one structured line, including the
// authorization ID. AWS keeps the details for at least 24 hours –
// so the ID has to land in the log before anyone starts looking.
export function logIfAccessDenied(error: unknown, operation: string): void {
  if (!isAccessDenied(error)) return;
  console.error(
    JSON.stringify({
      level: "ERROR",
      type: "AccessDenied",
      operation,
      region: process.env.AWS_REGION,
      authorizationId: extractAuthorizationId(error.message) ?? null,
      message: error.message,
    }),
  );
}
