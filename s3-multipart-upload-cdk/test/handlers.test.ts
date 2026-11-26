// test/handlers.test.ts
// Test the handlers with a fake S3 and an in-memory store – no AWS account needed.
import { S3Client } from "@aws-sdk/client-s3";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createHandlers } from "../src/handlers.js";
import { MiB } from "../src/plan.js";
import type { UploadRecord, UploadStore } from "../src/store.js";

function memoryStore(): UploadStore & { items: Map<string, UploadRecord> } {
  const items = new Map<string, UploadRecord>();
  return {
    items,
    async put(r) {
      items.set(r.id, { ...r });
    },
    async get(id) {
      return items.get(id);
    },
    async close(id, status) {
      const r = items.get(id);
      if (!r || r.status !== "OPEN") return false;
      r.status = status;
      return true;
    },
  };
}

// Real S3Client with dummy credentials: signing works offline,
// we replace send() with a fake implementation.
function fakeS3(parts: { PartNumber: number; Size: number; ETag: string }[]) {
  const s3 = new S3Client({
    region: "eu-central-1",
    credentials: { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "example" },
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
  const calls: string[] = [];
  s3.send = (async (cmd: { constructor: { name: string } }) => {
    const name = cmd.constructor.name;
    calls.push(name);
    if (name === "CreateMultipartUploadCommand") return { UploadId: "s3-upload-1" };
    if (name === "ListPartsCommand") return { Parts: parts, IsTruncated: false };
    if (name === "CompleteMultipartUploadCommand") return { ETag: '"abc-3"' };
    return {};
  }) as unknown as S3Client["send"];
  return { s3, calls };
}

const event = (body: unknown, id?: string) =>
  ({ body: JSON.stringify(body), isBase64Encoded: false, pathParameters: id ? { id } : undefined }) as unknown as APIGatewayProxyEventV2;

const size = 40 * MiB + 123;

describe("Multipart upload handlers", () => {
  it("starts an upload and plans three parts", async () => {
    const store = memoryStore();
    const { s3 } = fakeS3([]);
    const h = createHandlers({ s3, store, bucket: "audiobooks" });

    const res = await h.start(event({ fileName: "Mystery.m4b", contentType: "audio/x-m4b", size }));
    const body = JSON.parse(res.body as string);

    expect(res.statusCode).toBe(201);
    expect(body.partCount).toBe(3);
    expect(store.items.get(body.id)?.s3UploadId).toBe("s3-upload-1");
  });

  it("signs the size of each part, without a CRC32 checksum", async () => {
    const store = memoryStore();
    const { s3 } = fakeS3([]);
    const h = createHandlers({ s3, store, bucket: "audiobooks" });
    const { id } = JSON.parse((await h.start(event({ fileName: "a.m4b", contentType: "audio/x-m4b", size }))).body as string);

    const res = await h.signParts(event({ partNumbers: [3] }, id));
    const [part] = JSON.parse(res.body as string).parts;
    const url = new URL(part.url);

    expect(part.contentLength).toBe(8 * MiB + 123);
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain("content-length");
    expect(url.searchParams.has("x-amz-checksum-crc32")).toBe(false);
  });

  it("refuses to complete when a part is missing", async () => {
    const store = memoryStore();
    const { s3, calls } = fakeS3([
      { PartNumber: 1, Size: 16 * MiB, ETag: '"e1"' },
      { PartNumber: 3, Size: 8 * MiB + 123, ETag: '"e3"' },
    ]);
    const h = createHandlers({ s3, store, bucket: "audiobooks" });
    const { id } = JSON.parse((await h.start(event({ fileName: "a.m4b", contentType: "audio/x-m4b", size }))).body as string);

    const res = await h.complete(event({}, id));

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body as string).missing).toEqual([2]);
    expect(calls).not.toContain("CompleteMultipartUploadCommand");
  });

  it("completes the upload when all parts match", async () => {
    const store = memoryStore();
    const { s3 } = fakeS3([
      { PartNumber: 1, Size: 16 * MiB, ETag: '"e1"' },
      { PartNumber: 2, Size: 16 * MiB, ETag: '"e2"' },
      { PartNumber: 3, Size: 8 * MiB + 123, ETag: '"e3"' },
    ]);
    const h = createHandlers({ s3, store, bucket: "audiobooks" });
    const { id } = JSON.parse((await h.start(event({ fileName: "a.m4b", contentType: "audio/x-m4b", size }))).body as string);

    const res = await h.complete(event({}, id));

    expect(res.statusCode).toBe(200);
    expect(store.items.get(id)?.status).toBe("COMPLETED");
    // A second completion is rejected
    expect((await h.complete(event({}, id))).statusCode).toBe(409);
  });
});
