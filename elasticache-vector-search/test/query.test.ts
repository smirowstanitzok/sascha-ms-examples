// test/query.test.ts
import { describe, expect, it } from "vitest";
import { buildQuery, cleanWords, isGenre, toVectorBuffer } from "../src/query";

describe("buildQuery", () => {
  it("searches all books without a filter", () => {
    expect(buildQuery({})).toBe("*=>[KNN 5 @embedding $vec AS distance]");
  });

  it("combines genre, year and required word as a pre-filter", () => {
    expect(buildQuery({ genre: "crime", minYear: 2015, mustContain: "Train!" }, 3)).toBe(
      "(@genre:{crime} @year:[2015 +inf] @description:train)=>[KNN 3 @embedding $vec AS distance]",
    );
  });

  it("removes special characters and short words", () => {
    expect(cleanWords("Harbour | -Murder* on {x}")).toEqual(["harbour", "murder"]);
  });

  it("ignores invalid years", () => {
    expect(buildQuery({ minYear: Number("abc") })).toBe("*=>[KNN 5 @embedding $vec AS distance]");
  });
});

describe("isGenre", () => {
  it("only allows known genres", () => {
    expect(isGenre("crime")).toBe(true);
    expect(isGenre("crime} | @year:[0 +inf]")).toBe(false);
  });
});

describe("toVectorBuffer", () => {
  it("writes 4 bytes per dimension as little endian", () => {
    const buffer = toVectorBuffer([1, -0.5]);
    expect(buffer.length).toBe(8);
    expect(buffer.readFloatLE(0)).toBe(1);
    expect(buffer.readFloatLE(4)).toBe(-0.5);
  });
});
