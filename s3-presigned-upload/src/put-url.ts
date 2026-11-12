// src/put-url.ts
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Without this setting, the SDK also signs a CRC32 checksum of the empty body
const s3 = new S3Client({ requestChecksumCalculation: "WHEN_REQUIRED" });

export const erzeugePutUrl = (bucket: string, key: string): Promise<string> =>
  getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: "image/jpeg" }),
    { expiresIn: 300 },
  );
