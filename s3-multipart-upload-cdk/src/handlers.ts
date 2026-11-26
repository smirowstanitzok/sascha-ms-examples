// src/handlers.ts
// Four endpoints for the multipart upload: start, sign parts, complete, abort.
import { randomUUID } from "node:crypto";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  ListPartsCommand,
  type Part,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import {
  assertPartNumbers,
  partLength,
  planParts,
  safeFileName,
  ValidationError,
  validateRequest,
} from "./plan.js";
import type { UploadRecord, UploadStore } from "./store.js";

type Result = APIGatewayProxyStructuredResultV2;
type Handler = (event: APIGatewayProxyEventV2) => Promise<Result>;

const URL_TTL_SECONDS = 15 * 60; // each part URL is valid for 15 minutes
const RECORD_TTL_SECONDS = 24 * 60 * 60; // matches the lifecycle rule on the bucket

const json = (statusCode: number, body: unknown): Result => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

function parseBody(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError("Body is not valid JSON");
  }
}

// Catches validation errors and turns them into a 400
const safe =
  (fn: Handler): Handler =>
  async (event) => {
    try {
      return await fn(event);
    } catch (err) {
      if (err instanceof ValidationError) return json(400, { message: err.message });
      console.error(err);
      return json(500, { message: "Internal error" });
    }
  };

export interface Deps {
  s3: S3Client;
  store: UploadStore;
  bucket: string;
  now?: () => number;
}

export function createHandlers({ s3, store, bucket, now = Date.now }: Deps) {
  // Returns either the open upload or a ready-made error response
  async function loadOpen(
    event: APIGatewayProxyEventV2,
  ): Promise<{ record: UploadRecord } | { error: Result }> {
    const id = event.pathParameters?.id ?? "";
    const record = await store.get(id);
    if (!record) return { error: json(404, { message: "Upload not found" }) };
    if (record.status !== "OPEN") {
      return { error: json(409, { message: `Upload is ${record.status}` }) };
    }
    return { record };
  }

  const start = safe(async (event) => {
    const req = validateRequest(parseBody(event));
    const plan = planParts(req.size);
    const id = randomUUID();
    const key = `uploads/${id}/${safeFileName(req.fileName)}`;

    const created = await s3.send(
      new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: req.contentType }),
    );

    await store.put({
      id,
      s3UploadId: created.UploadId!,
      key,
      contentType: req.contentType,
      size: req.size,
      ...plan,
      status: "OPEN",
      expiresAt: Math.floor(now() / 1000) + RECORD_TTL_SECONDS,
    });

    return json(201, { id, key, ...plan });
  });

  const signParts = safe(async (event) => {
    const found = await loadOpen(event);
    if ("error" in found) return found.error;
    const { record } = found;
    const body = parseBody(event) as { partNumbers?: unknown };
    const numbers = assertPartNumbers(body.partNumbers, record.partCount);

    const urls = await Promise.all(
      numbers.map(async (partNumber) => {
        const contentLength = partLength(record, partNumber);
        const url = await getSignedUrl(
          s3,
          new UploadPartCommand({
            Bucket: bucket,
            Key: record.key,
            UploadId: record.s3UploadId,
            PartNumber: partNumber,
            // becomes part of the signature: S3 rejects parts with a different size
            ContentLength: contentLength,
          }),
          { expiresIn: URL_TTL_SECONDS },
        );
        return { partNumber, contentLength, url };
      }),
    );
    return json(200, { parts: urls });
  });

  const complete = safe(async (event) => {
    const found = await loadOpen(event);
    if ("error" in found) return found.error;
    const { record } = found;

    // We get the ETags straight from S3 instead of trusting the client
    const uploaded: Part[] = [];
    let marker: string | undefined;
    do {
      const page = await s3.send(
        new ListPartsCommand({
          Bucket: bucket,
          Key: record.key,
          UploadId: record.s3UploadId,
          PartNumberMarker: marker,
        }),
      );
      uploaded.push(...(page.Parts ?? []));
      marker = page.IsTruncated ? page.NextPartNumberMarker : undefined;
    } while (marker);

    const byNumber = new Map(uploaded.map((p) => [p.PartNumber!, p]));
    const missing: number[] = [];
    for (let n = 1; n <= record.partCount; n++) {
      const part = byNumber.get(n);
      if (!part || part.Size !== partLength(record, n)) missing.push(n);
    }
    if (missing.length > 0) {
      return json(409, { message: "Parts are missing or have the wrong size", missing });
    }

    const result = await s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: record.key,
        UploadId: record.s3UploadId,
        MultipartUpload: {
          Parts: [...byNumber.values()]
            .filter((p) => p.PartNumber! <= record.partCount)
            .sort((a, b) => a.PartNumber! - b.PartNumber!)
            .map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag })),
        },
      }),
    );
    await store.close(record.id, "COMPLETED");
    return json(200, { key: record.key, etag: result.ETag });
  });

  const abort = safe(async (event) => {
    const found = await loadOpen(event);
    if ("error" in found) return found.error;
    const { record } = found;
    await s3.send(
      new AbortMultipartUploadCommand({ Bucket: bucket, Key: record.key, UploadId: record.s3UploadId }),
    );
    await store.close(record.id, "ABORTED");
    return { statusCode: 204 };
  });

  return { start, signParts, complete, abort };
}
