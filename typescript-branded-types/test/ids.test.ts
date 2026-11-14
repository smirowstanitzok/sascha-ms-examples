// test/ids.test.ts
import { describe, expect, it } from "vitest";
import { bookId, memberId, newLoanId } from "../src/ids.js";
import { addCents, cents, formatEuro } from "../src/money.js";

describe("Smart Constructors", () => {
  it("accepts valid IDs", () => {
    expect(memberId("M-000042")).toBe("M-000042");
    expect(bookId("B-123456")).toBe("B-123456");
  });

  it("rejects swapped or broken IDs", () => {
    expect(() => memberId("B-123456")).toThrow("Invalid member ID");
    expect(() => bookId("123456")).toThrow("Invalid book ID");
  });

  it("creates loan IDs in the expected format", () => {
    expect(newLoanId(() => "1a2b3c4d-0000-0000-0000-000000000000")).toBe("L-1a2b3c4d");
  });
});

describe("Cents", () => {
  it("only calculates with whole cent amounts", () => {
    expect(addCents(cents(150), cents(50))).toBe(200);
    expect(() => cents(1.5)).toThrow("Invalid cent amount");
    expect(formatEuro(cents(250))).toMatch(/^2,50\s€$/);
  });
});
