// test/handler.test.ts
import { describe, expect, it, vi } from "vitest";
import { respond } from "../src/handler.js";
import { MemoryStore } from "./memory-store.js";

describe("respond", () => {
  it("rejects unknown genres without calling the model", async () => {
    const compute = vi.fn();
    const res = await respond("poetry", new MemoryStore(Date.now), compute);
    expect(res).toMatchObject({ statusCode: 400 });
    expect(compute).not.toHaveBeenCalled();
  });

  it("returns the recommendation and its source", async () => {
    const store = new MemoryStore(Date.now);
    const first = await respond("fantasy", store, async () => "The Hobbit");
    const second = await respond("fantasy", store, async () => "never");
    expect(JSON.parse((first as { body: string }).body).source).toBe("computed");
    expect(JSON.parse((second as { body: string }).body)).toMatchObject({ recommendation: "The Hobbit", source: "hit" });
  });

  it("answers 503 with Retry-After while another caller holds the lock", async () => {
    const store = new MemoryStore(Date.now);
    await store.setIfAbsent("lock:pick:v1:scifi", "other", 60_000);
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 50 });
    const res = await respond("scifi", store, async () => "Dune");
    vi.useRealTimers();
    expect(res).toMatchObject({ statusCode: 503, headers: { "retry-after": "2" } });
  });
});
