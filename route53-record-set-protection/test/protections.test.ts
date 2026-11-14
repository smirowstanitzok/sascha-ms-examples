// test/protections.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { chunk, diffProtections, normalizeName } from "../src/protections.js";

test("normalizes trailing dot, upper case and \\052", () => {
  assert.equal(normalizeName("WWW.Bikerental.example."), "www.bikerental.example");
  assert.equal(normalizeName("\\052.bikerental.example."), "*.bikerental.example");
});

test("finds missing and unexpected protections", () => {
  const { missing, unexpected } = diffProtections(
    [
      { name: "bikerental.example", type: "A" },
      { name: "bikerental.example", type: "MX" },
    ],
    [
      { name: "bikerental.example.", type: "A" },
      { name: "alt.bikerental.example.", type: "CNAME" },
    ],
  );
  assert.deepEqual(missing.map((m) => m.type), ["MX"]);
  assert.deepEqual(unexpected.map((u) => u.name), ["alt.bikerental.example."]);
});

test("splits into batches of at most 100", () => {
  const sizes = chunk(Array.from({ length: 230 }, (_, i) => i), 100).map((c) => c.length);
  assert.deepEqual(sizes, [100, 100, 30]);
});
