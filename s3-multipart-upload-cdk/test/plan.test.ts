// test/plan.test.ts
// Unit tests for the pure planning logic.
import { describe, expect, it } from "vitest";
import {
  assertPartNumbers,
  MAX_PARTS,
  MiB,
  partLength,
  planParts,
  safeFileName,
  ValidationError,
  validateRequest,
} from "../src/plan.js";

describe("plan", () => {
  it("accepts a valid request", () => {
    expect(validateRequest({ fileName: "a.m4b", contentType: "audio/x-m4b", size: 10 })).toEqual({
      fileName: "a.m4b",
      contentType: "audio/x-m4b",
      size: 10,
    });
  });

  it("rejects unknown content types and invalid sizes", () => {
    expect(() => validateRequest({ fileName: "a.exe", contentType: "application/x-msdownload", size: 10 })).toThrow(
      ValidationError,
    );
    expect(() => validateRequest({ fileName: "a.m4b", contentType: "audio/x-m4b", size: 0 })).toThrow(ValidationError);
  });

  it("uses 16 MiB parts for normal files", () => {
    expect(planParts(40 * MiB + 123)).toEqual({ partSize: 16 * MiB, partCount: 3 });
  });

  it("grows the part size so very large files stay below the part limit", () => {
    const plan = planParts(20 * 1024 * MiB * 10);
    expect(plan.partCount).toBeLessThanOrEqual(MAX_PARTS);
    expect(plan.partSize % MiB).toBe(0);
  });

  it("calculates the length of the last part", () => {
    const plan = { size: 40 * MiB + 123, partSize: 16 * MiB, partCount: 3 };
    expect(partLength(plan, 1)).toBe(16 * MiB);
    expect(partLength(plan, 3)).toBe(8 * MiB + 123);
  });

  it("cleans file names and checks part numbers", () => {
    expect(safeFileName("My Audiobook (Part 1).m4b")).toBe("my-audiobook-part-1-.m4b");
    expect(safeFileName("???")).toBe("file");
    expect(assertPartNumbers([1, 2], 3)).toEqual([1, 2]);
    expect(() => assertPartNumbers([4], 3)).toThrow(ValidationError);
  });
});
