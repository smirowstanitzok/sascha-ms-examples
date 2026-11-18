// src/request-context.ts
// Request context via AsyncLocalStorage: every invocation gets its own store,
// even when several invocations interleave in the same worker thread.
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  customerId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function withRequestContext<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

export function requestContext(): RequestContext {
  const ctx = storage.getStore();
  if (!ctx) throw new Error('No request context – called outside of withRequestContext?');
  return ctx;
}

// Small logger that adds the data of the current invocation automatically
export function log(msg: string, extra: Record<string, unknown> = {}): void {
  const ctx = storage.getStore();
  console.log(JSON.stringify({ msg, customerId: ctx?.customerId, ...extra }));
}
