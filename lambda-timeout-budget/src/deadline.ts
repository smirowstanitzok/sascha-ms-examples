// src/deadline.ts
export interface RemainingTimeSource {
  getRemainingTimeInMillis(): number;
}

export class DeadlineExceededError extends Error {
  constructor(public readonly step: string) {
    super(`Time budget exhausted before step "${step}"`);
    this.name = 'DeadlineExceededError';
  }
}

export interface DeadlineOptions {
  /** Reserve for logging, the response and cleanup (ms) */
  reserveMs?: number;
  /** Upper limit, e.g. because API Gateway gives up before Lambda (ms) */
  capMs?: number;
  /** Clock, replaceable in tests */
  now?: () => number;
}

export class Deadline {
  private readonly endsAt: number;
  private readonly now: () => number;

  constructor(totalMs: number, now: () => number = Date.now) {
    this.now = now;
    this.endsAt = now() + Math.max(0, totalMs);
  }

  static fromLambdaContext(ctx: RemainingTimeSource, opts: DeadlineOptions = {}): Deadline {
    const { reserveMs = 500, capMs = Number.POSITIVE_INFINITY, now = Date.now } = opts;
    const total = Math.min(ctx.getRemainingTimeInMillis() - reserveMs, capMs);
    return new Deadline(total, now);
  }

  remainingMs(): number {
    return Math.max(0, this.endsAt - this.now());
  }

  /** Budget for one step: at most maxMs and never more than what is left. */
  budgetFor(step: string, maxMs: number, minMs = 50): number {
    const ms = Math.min(maxMs, this.remainingMs());
    if (ms < minMs) throw new DeadlineExceededError(step);
    return ms;
  }

  /** AbortSignal that fires at the latest when the step budget runs out. */
  signalFor(step: string, maxMs: number): AbortSignal {
    return AbortSignal.timeout(this.budgetFor(step, maxMs));
  }
}

export function isTimeoutError(err: unknown): boolean {
  if (err instanceof DeadlineExceededError) return true;
  const name = (err as { name?: string } | null)?.name;
  return name === 'TimeoutError' || name === 'AbortError';
}
