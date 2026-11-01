// test/flags.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { loadFlags, parseFlags, SAFE_DEFAULTS } from "../src/flags";
import { quotePrice } from "../src/pricing";

const SUNDAY = new Date("2026-11-01T18:00:00Z");
const MONDAY = new Date("2026-11-02T18:00:00Z");

test("Sunday discount applies only when the flag is on", () => {
  const on = parseFlags({ "sunday-discount": { enabled: true, "discount-percent": 20 } });
  assert.equal(quotePrice("premium", 2, SUNDAY, on), 2320);
  assert.equal(quotePrice("premium", 2, MONDAY, on), 2900);
  assert.equal(quotePrice("premium", 2, SUNDAY, SAFE_DEFAULTS), 2900);
});

test("Discounts that are too high are capped at 50 percent", () => {
  const flags = parseFlags({ "sunday-discount": { enabled: true, "discount-percent": 90 } });
  assert.equal(flags.sundayDiscount.discountPercent, 50);
});

test("loadFlags reads the agent response", async () => {
  const server = createServer((_req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ "sales-stop": { enabled: true } }));
  }).listen(0);
  const { port } = server.address() as AddressInfo;
  const flags = await loadFlags(`http://127.0.0.1:${port}/applications/a/environments/b/configurations/c`);
  server.close();
  assert.equal(flags.salesStop.enabled, true);
  assert.equal(flags.sundayDiscount.enabled, false);
});

test("loadFlags falls back to safe defaults on timeout", async () => {
  const server = createServer(() => {
    /* never answers on purpose */
  }).listen(0);
  const { port } = server.address() as AddressInfo;
  const flags = await loadFlags(`http://127.0.0.1:${port}/x`, 100);
  server.closeAllConnections();
  server.close();
  assert.deepEqual(flags, SAFE_DEFAULTS);
});
