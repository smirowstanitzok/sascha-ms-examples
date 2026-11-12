// test/sign-download.test.ts
import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signDownload } from "../src/sign-download";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const base = {
  domain: "d111111abcdef8.cloudfront.net",
  objectKey: "books/the-little-baker.pdf",
  keyPairId: "K2EXAMPLEKEYID",
  privateKey,
  validForSeconds: 600,
  now: new Date("2026-11-12T15:00:00Z"),
};

// CloudFront uses URL-safe base64: + becomes -, = becomes _, / becomes ~
const fromCloudFrontBase64 = (s: string) =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "=").replace(/~/g, "/"), "base64");

describe("signDownload", () => {
  it("creates a URL with expiry, key ID and SHA-256 marker", () => {
    const { url, expiresAt } = signDownload(base);
    const u = new URL(url);
    expect(u.hostname).toBe(base.domain);
    expect(u.pathname).toBe("/books/the-little-baker.pdf");
    expect(u.searchParams.get("Expires")).toBe(String(Date.parse(expiresAt) / 1000));
    expect(u.searchParams.get("Key-Pair-Id")).toBe("K2EXAMPLEKEYID");
    expect(u.searchParams.get("Hash-Algorithm")).toBe("SHA256");
    expect(expiresAt).toBe("2026-11-12T15:10:00.000Z");
  });

  it("produces a signature that the public key verifies (canned policy)", () => {
    const { url } = signDownload(base);
    const u = new URL(url);
    const expires = Number(u.searchParams.get("Expires"));
    const resource = `https://${base.domain}${u.pathname}`;
    const policy = JSON.stringify({
      Statement: [{ Resource: resource, Condition: { DateLessThan: { "AWS:EpochTime": expires } } }],
    });
    const signature = fromCloudFrontBase64(u.searchParams.get("Signature")!);
    expect(verify("sha256", Buffer.from(policy), publicKey, signature)).toBe(true);
  });

  it("rejects links that would live too long", () => {
    expect(() => signDownload({ ...base, validForSeconds: 24 * 3600 })).toThrow(/between 30/);
  });

  it("encodes special characters in the object key", () => {
    const { url } = signDownload({ ...base, objectKey: "books/coffee & cake.pdf" });
    expect(new URL(url).pathname).toBe("/books/coffee%20%26%20cake.pdf");
  });
});
