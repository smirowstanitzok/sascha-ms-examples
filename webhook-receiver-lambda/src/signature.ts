// src/signature.ts
import { createHmac, timingSafeEqual } from 'node:crypto';

// How far the timestamp may drift from our own clock (5 minutes)
export const TOLERANCE_SECONDS = 5 * 60;

export type VerifyInput = {
  secret: string; // format "whsec_<base64>" as in the Standard Webhooks spec
  id: string | undefined;
  timestamp: string | undefined;
  signatureHeader: string | undefined;
  rawBody: string;
  nowSeconds?: number; // can be overridden in tests
};

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'missing-headers' | 'bad-timestamp' | 'too-old' | 'bad-signature' };

function keyFromSecret(secret: string): Buffer {
  const base64 = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  return Buffer.from(base64, 'base64');
}

// Computes the signature for "<id>.<timestamp>.<rawBody>" (HMAC-SHA256, Base64)
export function computeSignature(secret: string, id: string, timestamp: string, rawBody: string): string {
  return createHmac('sha256', keyFromSecret(secret))
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest('base64');
}

export function verifyWebhook(input: VerifyInput): VerifyResult {
  const { secret, id, timestamp, signatureHeader, rawBody } = input;
  if (!id || !timestamp || !signatureHeader) return { ok: false, reason: 'missing-headers' };
  if (!/^\d{1,12}$/.test(timestamp)) return { ok: false, reason: 'bad-timestamp' };

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > TOLERANCE_SECONDS) return { ok: false, reason: 'too-old' };

  const expected = Buffer.from(computeSignature(secret, id, timestamp, rawBody), 'base64');

  // The header can carry several signatures ("v1,abc v1,def"), e.g. during a key rotation
  for (const entry of signatureHeader.split(' ')) {
    const [version, value] = entry.split(',', 2);
    if (version !== 'v1' || !value) continue;
    const candidate = Buffer.from(value, 'base64');
    // timingSafeEqual requires buffers of equal length
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: 'bad-signature' };
}
