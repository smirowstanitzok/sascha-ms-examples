// test/policy.test.ts
import { describe, expect, it } from "vitest";
import {
  buildLookupQuery,
  detectBikeType,
  exactKey,
  isCacheable,
  isHit,
  normalizeQuestion,
  ttlWithJitter,
} from "../src/policy";

const scope = { topic: "rental" as const, kbVersion: "v3", bikeType: "none" };

describe("normalizeQuestion", () => {
  it("unifies spelling and punctuation", () => {
    expect(normalizeQuestion("  How LONG can I?!  ")).toBe("how long can i");
  });
});

describe("exactKey", () => {
  it("returns the same key for equivalent spellings", () => {
    expect(exactKey(scope, "How long can I?")).toBe(exactKey(scope, "how long can i"));
  });

  it("separates by knowledge version", () => {
    expect(exactKey(scope, "Question")).not.toBe(exactKey({ ...scope, kbVersion: "v4" }, "Question"));
  });
});

describe("isCacheable", () => {
  it("caches general questions", () => {
    expect(isCacheable("Can I return the bike at another station?")).toBe(true);
  });

  it("skips personal and time-sensitive questions", () => {
    expect(isCacheable("Where is my booking 4711815?")).toBe(false);
    expect(isCacheable("Write to lea@example.org")).toBe(false);
    expect(isCacheable("Is a cargo bike still free today?")).toBe(false);
  });
});

describe("detectBikeType", () => {
  it("detects bike types including synonyms", () => {
    expect(detectBikeType("Do I need a helmet for the e-bike?")).toBe("ebike");
    expect(detectBikeType("Do you have a cargobike?")).toBe("cargo");
    expect(detectBikeType("Do I need a license for the cargo bike?")).toBe("cargo");
  });

  it("sorts several types in a stable order", () => {
    expect(detectBikeType("Tandem or pedelec?")).toBe("ebikeandtandem");
  });

  it("reports none when no type occurs", () => {
    expect(detectBikeType("How long can I rent?")).toBe("none");
  });
});

describe("buildLookupQuery", () => {
  it("filters on topic, knowledge version and bike type", () => {
    expect(buildLookupQuery(scope)).toBe(
      "(@topic:{rental} @kbv:{v3} @bike:{none})=>[KNN 1 @embedding $vec AS distance]",
    );
  });

  it("rejects injected characters", () => {
    expect(() => buildLookupQuery({ ...scope, kbVersion: "v3} | @topic:{prices" })).toThrow(/Invalid/);
  });
});

describe("isHit", () => {
  it("only counts small distances as hits", () => {
    expect(isHit(0.05, 0.1)).toBe(true);
    expect(isHit(0.1, 0.1)).toBe(true);
    expect(isHit(0.25, 0.1)).toBe(false);
    expect(isHit(Number.NaN, 0.1)).toBe(false);
    expect(isHit(undefined, 0.1)).toBe(false);
  });
});

describe("ttlWithJitter", () => {
  it("stays between 90 and 100 percent of the base", () => {
    expect(ttlWithJitter(1000, 0.1, () => 0)).toBe(1000);
    expect(ttlWithJitter(1000, 0.1, () => 0.999)).toBe(901);
  });
});
