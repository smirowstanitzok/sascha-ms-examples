// src/once.ts
// Lazy initialization that runs exactly once, even with concurrent invocations:
// we memoize the promise, not the result. If initialization fails,
// the next invocation may try again.
export function once<T>(init: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    if (!pending) {
      pending = init().catch((error) => {
        pending = undefined;
        throw error;
      });
    }
    return pending;
  };
}
