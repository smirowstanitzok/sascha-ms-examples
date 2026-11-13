// test/leihfrist.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { berechneRueckgabe, istUeberfaellig } from "../src/leihfrist";

describe("leihfrist", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-13T10:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calculates a 28-day loan period", () => {
    expect(berechneRueckgabe(new Date()).toISOString()).toBe("2026-12-11T10:00:00.000Z");
  });

  it("detects overdue books", () => {
    expect(istUeberfaellig(new Date("2026-11-12T00:00:00Z"))).toBe(true);
    expect(istUeberfaellig(new Date("2026-11-14T00:00:00Z"))).toBe(false);
  });
});
