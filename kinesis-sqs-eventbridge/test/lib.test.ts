// test/lib.test.ts
import { describe, expect, it } from "vitest";
import { priceInCents } from "../src/lib/tariff.js";
import { InvalidTelemetryError, latestPerBike, parseTelemetry } from "../src/lib/telemetry.js";

describe("priceInCents", () => {
  it("charges the base fee plus started minutes", () => {
    expect(priceInCents("2026-11-16T10:00:00Z", "2026-11-16T10:12:30Z")).toBe(100 + 13 * 20);
  });

  it("caps the price at 15 euros", () => {
    expect(priceInCents("2026-11-16T08:00:00Z", "2026-11-16T18:00:00Z")).toBe(1500);
  });

  it("rejects an end before the start", () => {
    expect(() => priceInCents("2026-11-16T10:00:00Z", "2026-11-16T09:00:00Z")).toThrow(/End is before start/);
  });
});

describe("parseTelemetry", () => {
  it("accepts valid data", () => {
    const t = parseTelemetry("bike-0042", { lat: 52.52, lng: 13.4, batteryPercent: 64 });
    expect(t.bikeId).toBe("bike-0042");
  });

  it("rejects unknown bike IDs", () => {
    expect(() => parseTelemetry("auto-1", { lat: 1, lng: 1, batteryPercent: 5 })).toThrow(InvalidTelemetryError);
  });
});

describe("latestPerBike", () => {
  it("keeps the latest record per bike", () => {
    const base = { lat: 0, lng: 0, recordedAt: "2026-11-16T10:00:00Z" };
    const latest = latestPerBike([
      { ...base, bikeId: "bike-001", batteryPercent: 50 },
      { ...base, bikeId: "bike-001", batteryPercent: 18 },
      { ...base, bikeId: "bike-002", batteryPercent: 90 },
    ]);
    expect(latest.get("bike-001")?.batteryPercent).toBe(18);
    expect(latest.size).toBe(2);
  });
});
