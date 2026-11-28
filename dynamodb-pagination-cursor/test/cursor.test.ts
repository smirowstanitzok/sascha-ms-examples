// test/cursor.test.ts
import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, InvalidCursorError } from "../src/cursor.js";

const secret = "test-secret-local-only";
const key = { pk: "STATION#harbor", sk: "RENTAL#2026-11-01T10:00:00Z#r-1" };

describe("Cursor", () => {
  it("returns the key unchanged", () => {
    const cursor = encodeCursor(key, "harbor|*", secret);
    expect(decodeCursor(cursor, "harbor|*", secret)).toEqual(key);
  });

  it("rejects a tampered cursor", () => {
    const cursor = encodeCursor(key, "harbor|*", secret);
    const forged = Buffer.from(JSON.stringify({ v: 1, k: { pk: "STATION#central", sk: "x" }, q: "harbor|*", exp: 9e9 })).toString("base64url");
    const tampered = `${forged}.${cursor.split(".")[1]}`;
    expect(() => decodeCursor(tampered, "harbor|*", secret)).toThrow(InvalidCursorError);
  });

  it("rejects a cursor for a different query", () => {
    const cursor = encodeCursor(key, "harbor|*", secret);
    expect(() => decodeCursor(cursor, "harbor|open", secret)).toThrow(/different query/);
  });

  it("rejects an expired cursor", () => {
    const cursor = encodeCursor(key, "harbor|*", secret, 60, Date.UTC(2026, 10, 1));
    expect(() => decodeCursor(cursor, "harbor|*", secret, Date.UTC(2026, 10, 2))).toThrow(/expired/);
  });

  it("rejects garbage", () => {
    expect(() => decodeCursor("not-a-cursor", "harbor|*", secret)).toThrow(InvalidCursorError);
  });
});
