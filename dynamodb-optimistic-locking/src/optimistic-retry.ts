// src/optimistic-retry.ts
import { VersionConflictError } from './bike-repository.js';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs read -> decide -> conditional write again if another request was faster.
 * Important: `operation` has to read the item again on every attempt.
 */
export async function withOptimisticRetry<T>(
  operation: (attempt: number) => Promise<T>,
  { maxAttempts = 3, baseDelayMs = 20, sleep = defaultSleep }: RetryOptions = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (!(error instanceof VersionConflictError) || attempt >= maxAttempts) throw error;
      // Full jitter: random wait between 0 and base * 2^(attempt-1)
      await sleep(Math.random() * baseDelayMs * 2 ** (attempt - 1));
    }
  }
}
