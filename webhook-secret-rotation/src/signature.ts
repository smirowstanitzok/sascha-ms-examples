// src/signature.ts
import { createHmac, timingSafeEqual } from "node:crypto";

// How far the timestamp may drift from our own clock
export const TOLERANCE_SECONDS = 5 * 60;

// "whsec_<base64>" -> key as a Buffer
export function keyFromSecret(secret: string): Buffer {
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  return Buffer.from(raw, "base64");
}

function hmac(secret: string, msgId: string, timestamp: number, body: string): string {
  return createHmac("sha256", keyFromSecret(secret))
    .update(`${msgId}.${timestamp}.${body}`)
    .digest("base64");
}

// Sender: one signature per active secret, separated by spaces
export function signWebhook(
  secrets: string[],
  msgId: string,
  timestamp: number,
  body: string,
): string {
  if (secrets.length === 0) throw new Error("no signing secret available");
  return secrets.map((s) => `v1,${hmac(s, msgId, timestamp, body)}`).join(" ");
}

export type VerifyInput = {
  secrets: string[]; // all secrets that are currently valid
  msgId?: string;
  timestamp?: string;
  signatureHeader?: string;
  body: string;
  nowSeconds?: number; // can be overridden in tests
};

export type VerifyResult =
  | { ok: true; matchedKeyIndex: number }
  | { ok: false; reason: "missing-headers" | "bad-timestamp" | "too-old" | "bad-signature" };

// Receiver: check every received signature against every valid secret
export function verifyWebhook(input: VerifyInput): VerifyResult {
  const { secrets, msgId, timestamp, signatureHeader, body } = input;
  if (!msgId || !timestamp || !signatureHeader) return { ok: false, reason: "missing-headers" };

  const ts = Number(timestamp);
  if (!Number.isInteger(ts)) return { ok: false, reason: "bad-timestamp" };
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TOLERANCE_SECONDS) return { ok: false, reason: "too-old" };

  const received = signatureHeader
    .split(" ")
    .map((entry) => entry.split(","))
    .filter(([version, value]) => version === "v1" && value)
    .map(([, value]) => Buffer.from(value, "base64"));

  for (const [index, secret] of secrets.entries()) {
    const expected = Buffer.from(hmac(secret, msgId, ts, body), "base64");
    for (const candidate of received) {
      // timingSafeEqual requires buffers of equal length
      if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
        return { ok: true, matchedKeyIndex: index };
      }
    }
  }
  return { ok: false, reason: "bad-signature" };
}
