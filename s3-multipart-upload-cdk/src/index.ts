// src/index.ts
// Lambda entry point: wire up real clients, export handlers.
import { S3Client } from "@aws-sdk/client-s3";
import { createHandlers } from "./handlers.js";
import { dynamoStore } from "./store.js";

// Without WHEN_REQUIRED the SDK signs a CRC32 checksum of the empty body into the URL
const s3 = new S3Client({ requestChecksumCalculation: "WHEN_REQUIRED" });

const handlers = createHandlers({
  s3,
  store: dynamoStore(process.env.TABLE_NAME!),
  bucket: process.env.BUCKET_NAME!,
});

export const start = handlers.start;
export const signParts = handlers.signParts;
export const complete = handlers.complete;
export const abort = handlers.abort;
