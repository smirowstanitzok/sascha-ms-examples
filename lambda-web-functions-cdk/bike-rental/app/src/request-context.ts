// app/src/request-context.ts
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

type RequestContext = { requestId: string; startedAt: number };

const storage = new AsyncLocalStorage<RequestContext>();

// Every request gets its own context – even when 64 run in parallel
export const withRequestContext: RequestHandler = (_req, res, next) => {
  const requestId = randomUUID();
  res.setHeader("x-request-id", requestId);
  storage.run({ requestId, startedAt: Date.now() }, next);
};

export function log(message: string, extra: Record<string, unknown> = {}): void {
  const ctx = storage.getStore();
  console.log(
    JSON.stringify({
      message,
      requestId: ctx?.requestId,
      elapsedMs: ctx ? Date.now() - ctx.startedAt : undefined,
      ...extra,
    }),
  );
}
