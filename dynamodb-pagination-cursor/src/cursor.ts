// src/cursor.ts
import { createHmac, timingSafeEqual } from "node:crypto";

// The key where DynamoDB should continue reading (partition and sort key).
export type PageKey = { pk: string; sk: string };

type CursorPayload = {
  v: 1; // format version in case the cursor changes later
  k: PageKey; // ExclusiveStartKey for the next query
  q: string; // query fingerprint (station + filter)
  exp: number; // expiry in seconds since 1970
};

export class InvalidCursorError extends Error {}

const sign = (data: string, secret: string) =>
  createHmac("sha256", secret).update(data).digest("base64url");

export function encodeCursor(
  key: PageKey,
  queryFingerprint: string,
  secret: string,
  ttlSeconds = 3600,
  now = Date.now(),
): string {
  const payload: CursorPayload = {
    v: 1,
    k: key,
    q: queryFingerprint,
    exp: Math.floor(now / 1000) + ttlSeconds,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, secret)}`;
}

export function decodeCursor(
  cursor: string,
  queryFingerprint: string,
  secret: string,
  now = Date.now(),
): PageKey {
  const [data, signature, ...rest] = cursor.split(".");
  if (!data || !signature || rest.length > 0) {
    throw new InvalidCursorError("Cursor has an invalid format");
  }
  const expected = Buffer.from(sign(data, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw new InvalidCursorError("Cursor signature does not match");
  }
  let payload: CursorPayload;
  try {
    payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    throw new InvalidCursorError("Cursor is not valid JSON");
  }
  if (payload.v !== 1 || typeof payload.k?.pk !== "string" || typeof payload.k?.sk !== "string") {
    throw new InvalidCursorError("Cursor content is incomplete");
  }
  if (payload.q !== queryFingerprint) {
    throw new InvalidCursorError("Cursor belongs to a different query");
  }
  if (payload.exp < Math.floor(now / 1000)) {
    throw new InvalidCursorError("Cursor has expired");
  }
  return payload.k;
}
