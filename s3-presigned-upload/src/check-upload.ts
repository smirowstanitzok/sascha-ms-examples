// src/check-upload.ts
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { S3Event } from "aws-lambda";
import { erkenneTyp } from "./lib/file-types";

const s3 = new S3Client({});

export const handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    // Keys arrive URL-encoded (spaces as “+”)
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    if (!key.startsWith("eingang/")) continue;

    const kopf = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key, Range: "bytes=0-15" }),
    );
    const bytes = await kopf.Body!.transformToByteArray();
    const meta = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));

    const echterTyp = erkenneTyp(bytes);
    if (!echterTyp || echterTyp !== meta.ContentType) {
      console.warn(JSON.stringify({ msg: "Upload rejected", key, echterTyp, angegeben: meta.ContentType }));
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      continue;
    }

    const zielKey = key.replace(/^eingang\//, "geprueft/");
    await s3.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: zielKey,
        CopySource: `${bucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}`,
      }),
    );
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    console.log(JSON.stringify({ msg: "Upload checked", zielKey, bytes: meta.ContentLength }));
  }
};
