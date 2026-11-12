// test/file-types.test.ts
import { describe, expect, it } from "vitest";
import { erkenneTyp, istErlaubterTyp } from "../src/lib/file-types";

describe("erkenneTyp", () => {
  it("detects JPEG", () => {
    expect(erkenneTyp(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
  });
  it("detects PNG", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(erkenneTyp(png)).toBe("image/png");
  });
  it("detects WebP", () => {
    const webp = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ");
    expect(erkenneTyp(webp)).toBe("image/webp");
  });
  it("rejects an HTML file disguised as an image", () => {
    expect(erkenneTyp(new TextEncoder().encode("<html><script>"))).toBeUndefined();
  });
});

describe("istErlaubterTyp", () => {
  it("accepts only the three image types", () => {
    expect(istErlaubterTyp("image/png")).toBe(true);
    expect(istErlaubterTyp("image/svg+xml")).toBe(false);
    expect(istErlaubterTyp(42)).toBe(false);
  });
});
