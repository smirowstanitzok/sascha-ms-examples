// test/signature.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { signWebhook, verifyWebhook } from "../src/signature.ts";
import { newSecret, shouldRetire } from "../src/rotation.ts";

const oldSecret = newSecret();
const freshSecret = newSecret();
const body = JSON.stringify({ type: "rental.completed", data: { rentalId: "r-17" } });
const now = 1_790_000_000;

test("old receiver accepts the double signature", () => {
  const sig = signWebhook([freshSecret, oldSecret], "msg_1", now, body);
  const r = verifyWebhook({ secrets: [oldSecret], msgId: "msg_1", timestamp: String(now), signatureHeader: sig, body, nowSeconds: now });
  assert.deepEqual(r, { ok: true, matchedKeyIndex: 0 });
});

test("new receiver accepts the double signature", () => {
  const sig = signWebhook([freshSecret, oldSecret], "msg_2", now, body);
  const r = verifyWebhook({ secrets: [freshSecret], msgId: "msg_2", timestamp: String(now), signatureHeader: sig, body, nowSeconds: now });
  assert.equal(r.ok, true);
});

test("receiver with two secrets reports which one matched", () => {
  const sig = signWebhook([oldSecret], "msg_3", now, body);
  const r = verifyWebhook({ secrets: [freshSecret, oldSecret], msgId: "msg_3", timestamp: String(now), signatureHeader: sig, body, nowSeconds: now });
  assert.deepEqual(r, { ok: true, matchedKeyIndex: 1 });
});

test("after retiring, the old secret is rejected", () => {
  const sig = signWebhook([oldSecret], "msg_4", now, body);
  const r = verifyWebhook({ secrets: [freshSecret], msgId: "msg_4", timestamp: String(now), signatureHeader: sig, body, nowSeconds: now });
  assert.deepEqual(r, { ok: false, reason: "bad-signature" });
});

test("modified body fails", () => {
  const sig = signWebhook([freshSecret], "msg_5", now, body);
  const r = verifyWebhook({ secrets: [freshSecret], msgId: "msg_5", timestamp: String(now), signatureHeader: sig, body: body + " ", nowSeconds: now });
  assert.equal(r.ok, false);
});

test("timestamp that is too old fails", () => {
  const sig = signWebhook([freshSecret], "msg_6", now - 600, body);
  const r = verifyWebhook({ secrets: [freshSecret], msgId: "msg_6", timestamp: String(now - 600), signatureHeader: sig, body, nowSeconds: now });
  assert.deepEqual(r, { ok: false, reason: "too-old" });
});

test("old secret stays until the end of the window", () => {
  const since = new Date("2026-11-23T10:00:00Z");
  assert.equal(shouldRetire(since, new Date("2026-11-24T09:59:00Z"), 24), false);
  assert.equal(shouldRetire(since, new Date("2026-11-24T10:00:00Z"), 24), true);
});
