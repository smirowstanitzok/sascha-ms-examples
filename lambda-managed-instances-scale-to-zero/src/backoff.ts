// src/backoff.ts
// Exponential backoff with "full jitter" for invocations that are
// rejected with HTTP 429 at first after a scale to zero.

export interface BackoffOptions {
  baseMs: number;      // starting value, e.g. 1,000 ms
  capMs: number;       // upper bound per wait, e.g. 30,000 ms
  maxTotalMs: number;  // total budget, e.g. 8 minutes
  random?: () => number;
}

export function backoffDelays(opts: BackoffOptions): number[] {
  const random = opts.random ?? Math.random;
  const delays: number[] = [];
  let total = 0;
  for (let attempt = 0; ; attempt++) {
    const ceiling = Math.min(opts.capMs, opts.baseMs * 2 ** attempt);
    const delay = Math.max(opts.baseMs, Math.round(ceiling * random()));
    if (total + delay > opts.maxTotalMs) break;
    delays.push(delay);
    total += delay;
  }
  return delays;
}

export function isThrottle(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === 'TooManyRequestsException' || e?.$metadata?.httpStatusCode === 429;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withBackoff<T>(
  call: () => Promise<T>,
  opts: BackoffOptions,
  onRetry: (attempt: number, delayMs: number) => void = () => {},
  wait: (ms: number) => Promise<unknown> = sleep,
): Promise<T> {
  const delays = backoffDelays(opts);
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      // Only retry throttles, pass real errors on immediately
      if (!isThrottle(error) || attempt >= delays.length) throw error;
      onRetry(attempt + 1, delays[attempt]);
      await wait(delays[attempt]);
    }
  }
}
