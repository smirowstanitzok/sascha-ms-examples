// src/sign-download.ts
import { getSignedUrl } from "@aws-sdk/cloudfront-signer";

export interface SignDownloadInput {
  domain: string; // e.g. d111111abcdef8.cloudfront.net
  objectKey: string; // e.g. books/the-little-baker.pdf
  keyPairId: string; // ID of the CloudFront public key
  privateKey: string; // PEM, never written to logs
  validForSeconds: number;
  now?: Date;
}

export interface SignedDownload {
  url: string;
  expiresAt: string;
}

const MAX_VALIDITY_SECONDS = 60 * 60; // never hand out links longer than one hour

export function signDownload(input: SignDownloadInput): SignedDownload {
  if (input.validForSeconds < 30 || input.validForSeconds > MAX_VALIDITY_SECONDS) {
    throw new Error(`validForSeconds must be between 30 and ${MAX_VALIDITY_SECONDS}`);
  }
  const now = input.now ?? new Date();
  const expires = new Date(now.getTime() + input.validForSeconds * 1000);
  const path = input.objectKey.split("/").map(encodeURIComponent).join("/");

  const url = getSignedUrl({
    url: `https://${input.domain}/${path}`,
    keyPairId: input.keyPairId,
    privateKey: input.privateKey,
    dateLessThan: expires,
    algorithm: "SHA256",
  });

  return { url, expiresAt: expires.toISOString() };
}
