// test/stampede.test.ts
import { describe, expect, it, vi } from "vitest";
import { CacheBusyError, getOrCompute, shouldRefreshEarly, withJitter } from "../src/stampede.js";
import { MemoryStore } from "./memory-store.js";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("getOrCompute", () => {
  it("computes only once for 50 parallel requests on an empty cache", async () => {
    const store = new MemoryStore(Date.now);
    const compute = vi.fn(async () => {
      await wait(50);
      return "The Name of the Rose";
    });

    const results = await Promise.all(
      Array.from({ length: 50 }, () =>
        getOrCompute(store, "pick:crime", compute, { pollMs: 5, maxWaitMs: 1000, jitter: 0 }),
      ),
    );

    expect(compute).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.source === "computed")).toHaveLength(1);
    expect(results.filter((r) => r.source === "waited")).toHaveLength(49);
    expect(new Set(results.map((r) => r.value))).toEqual(new Set(["The Name of the Rose"]));
  });

  it("serves the stale value while exactly one caller refreshes", async () => {
    let now = 0;
    const store = new MemoryStore(() => now);
    const opts = { now: () => now, random: () => 0.5, jitter: 0, freshMs: 1000, staleMs: 10_000 };
    await getOrCompute(store, "k", async () => "old", opts);

    now = 2000; // fresh period is over, entry is still stored
    let release!: () => void;
    const slow = getOrCompute(store, "k", () => new Promise<string>((r) => (release = () => r("new"))), opts);
    await wait(0);
    const others = await Promise.all([1, 2, 3].map(() => getOrCompute(store, "k", async () => "never", opts)));
    expect(others.map((r) => r.source)).toEqual(["stale", "stale", "stale"]);
    expect(others.map((r) => r.value)).toEqual(["old", "old", "old"]);

    release();
    expect(await slow).toEqual({ value: "new", source: "computed" });
    expect((await getOrCompute(store, "k", async () => "never", opts)).value).toBe("new");
  });

  it("gives up with CacheBusyError when the lock holder takes too long", async () => {
    const store = new MemoryStore(Date.now);
    await store.setIfAbsent("lock:k", "someone-else", 60_000);
    await expect(
      getOrCompute(store, "k", async () => "x", { maxWaitMs: 30, pollMs: 5 }),
    ).rejects.toBeInstanceOf(CacheBusyError);
  });

  it("releases the lock even if the computation fails", async () => {
    const store = new MemoryStore(Date.now);
    await expect(
      getOrCompute(store, "k", async () => {
        throw new Error("Bedrock throttled");
      }),
    ).rejects.toThrow("Bedrock throttled");
    expect(await store.get("lock:k")).toBeNull();
  });

  it("does not delete a lock that belongs to someone else", async () => {
    let now = 0;
    const store = new MemoryStore(() => now);
    const opts = { now: () => now, lockMs: 100 };
    const run = getOrCompute(store, "k", async () => {
      now = 150; // our lock expired, someone else takes over
      await store.setIfAbsent("lock:k", "second-caller", 100);
      return "value";
    }, opts);
    await run;
    expect(await store.get("lock:k")).toBe("second-caller");
  });
});

describe("shouldRefreshEarly (XFetch)", () => {
  const entry = { value: "v", computeMs: 2000, freshUntil: 100_000 };

  it("almost never refreshes long before expiry", () => {
    expect(shouldRefreshEarly(entry, 50_000, 1, 0.5)).toBe(false);
  });

  it("refreshes shortly before expiry with a small random number", () => {
    // 2000 ms * -ln(0.01) ≈ 9210 ms head start
    expect(shouldRefreshEarly(entry, 95_000, 1, 0.01)).toBe(true);
    expect(shouldRefreshEarly(entry, 95_000, 1, 0.9)).toBe(false);
  });

  it("always refreshes after expiry", () => {
    expect(shouldRefreshEarly(entry, 100_000, 1, 1)).toBe(true);
  });
});

describe("withJitter", () => {
  it("stays within ±10 %", () => {
    expect(withJitter(600_000, 0.1, 0)).toBe(540_000);
    expect(withJitter(600_000, 0.1, 1)).toBe(660_000);
    expect(withJitter(600_000, 0.1, 0.5)).toBe(600_000);
  });
});
