// test/memory-store.ts
import type { CacheStore } from "../src/stampede.js";

/** In-memory store with the same semantics as SET NX PX – for tests only. */
export class MemoryStore implements CacheStore {
  private data = new Map<string, { value: string; expiresAt: number }>();
  constructor(private readonly clock: () => number) {}

  private alive(key: string) {
    const item = this.data.get(key);
    if (item && item.expiresAt <= this.clock()) this.data.delete(key);
    return this.data.get(key);
  }
  async get(key: string) {
    return this.alive(key)?.value ?? null;
  }
  async set(key: string, value: string, ttlMs: number) {
    this.data.set(key, { value, expiresAt: this.clock() + ttlMs });
  }
  async setIfAbsent(key: string, value: string, ttlMs: number) {
    if (this.alive(key)) return false;
    this.data.set(key, { value, expiresAt: this.clock() + ttlMs });
    return true;
  }
  async deleteIfEquals(key: string, value: string) {
    if (this.alive(key)?.value !== value) return false;
    return this.data.delete(key);
  }
}
