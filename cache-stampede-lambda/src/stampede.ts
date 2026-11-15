// src/stampede.ts
import { randomUUID } from "node:crypto";

/** Minimal cache interface: Valkey in production, an in-memory fake in tests. */
export interface CacheStore {
  get(key: string): Promise<string | null>;
  /** SET key value PX ttlMs */
  set(key: string, value: string, ttlMs: number): Promise<void>;
  /** SET key value NX PX ttlMs – true if this caller wrote the key */
  setIfAbsent(key: string, value: string, ttlMs: number): Promise<boolean>;
  /** Deletes the key only if it still holds the given value (lock release). */
  deleteIfEquals(key: string, value: string): Promise<boolean>;
}

/** What we store per key: the value plus the data XFetch needs. */
export interface CacheEntry {
  value: string;
  /** How long the last computation took (ms) – "delta" in XFetch */
  computeMs: number;
  /** From this point on the entry counts as stale (ms since epoch) */
  freshUntil: number;
}

export type Source = "hit" | "computed" | "stale" | "waited";

export interface Result {
  value: string;
  source: Source;
}

export interface StampedeOptions {
  /** How long an entry stays fresh */
  freshMs: number;
  /** How long a stale entry may still be served while someone refreshes it */
  staleMs: number;
  /** Lock lifetime: must be longer than the slowest computation */
  lockMs: number;
  /** How long callers without the lock wait for the result at most */
  maxWaitMs: number;
  /** Polling interval while waiting */
  pollMs: number;
  /** XFetch factor: 1 is a good start, > 1 refreshes earlier */
  beta: number;
  /** Random variation of freshMs (0.1 = ±10 %) */
  jitter: number;
  now?: () => number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export const defaultOptions: StampedeOptions = {
  freshMs: 10 * 60_000,
  staleMs: 60 * 60_000,
  lockMs: 20_000,
  maxWaitMs: 3_000,
  pollMs: 150,
  beta: 1,
  jitter: 0.1,
};

/** Thrown when the value is not ready within maxWaitMs. */
export class CacheBusyError extends Error {
  constructor(public readonly key: string) {
    super(`Value for ${key} is being computed, please retry shortly`);
    this.name = "CacheBusyError";
  }
}

/**
 * XFetch (Vattani et al. 2015): the closer the expiry, the more likely
 * a single caller refreshes early. random() lies in (0, 1].
 */
export function shouldRefreshEarly(
  entry: CacheEntry,
  now: number,
  beta: number,
  random: number,
): boolean {
  const safeRandom = Math.min(Math.max(random, Number.MIN_VALUE), 1);
  return now - entry.computeMs * beta * Math.log(safeRandom) >= entry.freshUntil;
}

/** Spreads expiry times so that keys written together do not expire together. */
export function withJitter(ms: number, jitter: number, random: number): number {
  return Math.round(ms * (1 + jitter * (random * 2 - 1)));
}

export function parseEntry(raw: string | null): CacheEntry | undefined {
  if (!raw) return undefined;
  try {
    const entry = JSON.parse(raw) as CacheEntry;
    return typeof entry.value === "string" && typeof entry.freshUntil === "number"
      ? entry
      : undefined;
  } catch {
    return undefined; // broken entries count as a miss
  }
}

/**
 * Reads a value from the cache. Only the caller holding the lock computes it;
 * everyone else gets the stale value or waits briefly for the new one.
 */
export async function getOrCompute(
  store: CacheStore,
  key: string,
  compute: () => Promise<string>,
  options: Partial<StampedeOptions> = {},
): Promise<Result> {
  const o = { ...defaultOptions, ...options };
  const now = o.now ?? Date.now;
  const random = o.random ?? Math.random;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const entry = parseEntry(await store.get(key));
  if (entry && !shouldRefreshEarly(entry, now(), o.beta, random())) {
    return { value: entry.value, source: "hit" };
  }

  const lockKey = `lock:${key}`;
  const token = randomUUID();
  const gotLock = await store.setIfAbsent(lockKey, token, o.lockMs);

  if (gotLock) {
    try {
      const started = now();
      const value = await compute();
      const computeMs = Math.max(1, now() - started);
      const freshMs = withJitter(o.freshMs, o.jitter, random());
      const fresh: CacheEntry = { value, computeMs, freshUntil: now() + freshMs };
      await store.set(key, JSON.stringify(fresh), freshMs + o.staleMs);
      return { value, source: "computed" };
    } finally {
      await store.deleteIfEquals(lockKey, token);
    }
  }

  // Someone else is computing. A stale value is better than waiting.
  if (entry) return { value: entry.value, source: entry.freshUntil > now() ? "hit" : "stale" };

  const deadline = now() + o.maxWaitMs;
  while (now() < deadline) {
    await sleep(o.pollMs);
    const ready = parseEntry(await store.get(key));
    if (ready) return { value: ready.value, source: "waited" };
  }
  throw new CacheBusyError(key);
}
