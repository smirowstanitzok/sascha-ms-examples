// test/list-rentals.test.ts
import { describe, expect, it } from "vitest";
import { listRentals } from "../src/list-rentals.js";
import { createFakeClient, rentalsFor } from "./fake-dynamodb.js";

const base = { tableName: "rentals", stationId: "harbor" };

describe("listRentals", () => {
  it("pages through all items without gaps when unfiltered", async () => {
    const rows = rentalsFor("harbor", 45);
    const client = createFakeClient(rows);
    const seen: string[] = [];
    let startKey;
    do {
      const page = await listRentals(client, { ...base, limit: 20, startKey });
      seen.push(...page.items.map((r) => r.rentalId));
      startKey = page.nextKey;
    } while (startKey);
    expect(seen).toHaveLength(45);
    expect(new Set(seen).size).toBe(45);
    expect(seen[0]).toBe("r-044"); // newest first
  });

  it("fills a filtered page across several queries", async () => {
    const rows = rentalsFor("harbor", 200, 10); // only every tenth rental is open
    const client = createFakeClient(rows);
    const page = await listRentals(client, { ...base, limit: 5, status: "open" });
    expect(page.items).toHaveLength(5);
    expect(page.items.every((r) => r.status === "open")).toBe(true);
    expect(client.calls.length).toBeGreaterThan(1);
  });

  it("does not lose items when trimming", async () => {
    const rows = rentalsFor("harbor", 120, 2);
    const client = createFakeClient(rows);
    const seen: string[] = [];
    let startKey;
    do {
      const page = await listRentals(client, { ...base, limit: 7, status: "open", startKey });
      seen.push(...page.items.map((r) => r.rentalId));
      startKey = page.nextKey;
    } while (startKey);
    const expected = rows.filter((r) => r.status === "open").map((r) => r.rentalId).reverse();
    expect(seen).toEqual(expected);
  });

  it("returns a short page with cursor for rare matches", async () => {
    const rows = rentalsFor("harbor", 500, 400);
    const client = createFakeClient(rows);
    const page = await listRentals(client, { ...base, limit: 5, status: "open", maxRounds: 2 });
    expect(page.items.length).toBeLessThan(5);
    expect(page.nextKey).toBeDefined();
    expect(client.calls).toHaveLength(2);
  });
});
