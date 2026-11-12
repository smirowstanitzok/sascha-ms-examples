// src/upload-url.ts
import { randomUUID } from "node:crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ERLAUBTE_TYPEN, MAX_BYTES, istErlaubterTyp } from "./lib/file-types";

const s3 = new S3Client({});
const BUCKET = process.env.BUCKET_NAME!;
const GUELTIG_SEKUNDEN = 300; // 5 minutes are enough for a photo from a phone

const antwort = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const ausleihId = event.pathParameters?.ausleihId ?? "";
  if (!/^[A-Za-z0-9-]{4,40}$/.test(ausleihId)) {
    return antwort(400, { fehler: "Invalid rental ID" });
  }

  let contentType: unknown;
  try {
    contentType = JSON.parse(event.body ?? "{}").contentType;
  } catch {
    return antwort(400, { fehler: "Body is not valid JSON" });
  }
  if (!istErlaubterTyp(contentType)) {
    return antwort(415, { fehler: "Only JPEG, PNG and WebP are allowed" });
  }

  // The server decides the object key – never take the file name from the client
  const key = `eingang/${ausleihId}/${randomUUID()}.${ERLAUBTE_TYPEN[contentType].endung}`;

  const { url, fields } = await createPresignedPost(s3, {
    Bucket: BUCKET,
    Key: key,
    Conditions: [
      ["content-length-range", 1, MAX_BYTES],
      ["eq", "$Content-Type", contentType],
    ],
    Fields: { "Content-Type": contentType },
    Expires: GUELTIG_SEKUNDEN,
  });

  return antwort(201, { url, fields, key, gueltigSekunden: GUELTIG_SEKUNDEN });
};
