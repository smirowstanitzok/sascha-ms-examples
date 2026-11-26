// src/plan.ts
// Pure logic without AWS calls: validate input and plan parts.
// This makes it testable without mocks.

export const MiB = 1024 * 1024;
export const MIN_PART_SIZE = 5 * MiB; // S3 minimum for every part except the last
export const MAX_PARTS = 10_000; // S3 maximum per multipart upload
export const DEFAULT_PART_SIZE = 16 * MiB;

// Limit of our example app (audiobook archive), not of S3
export const MAX_FILE_SIZE = 20 * 1024 * MiB; // 20 GiB

const ALLOWED_TYPES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4b",
  "application/zip",
]);

export interface UploadRequest {
  fileName: string;
  contentType: string;
  size: number;
}

export interface UploadPlan {
  partSize: number;
  partCount: number;
}

export class ValidationError extends Error {}

export function validateRequest(input: unknown): UploadRequest {
  const body = (input ?? {}) as Partial<UploadRequest>;
  if (typeof body.fileName !== "string" || body.fileName.trim() === "") {
    throw new ValidationError("fileName is missing");
  }
  if (typeof body.contentType !== "string" || !ALLOWED_TYPES.has(body.contentType)) {
    throw new ValidationError("contentType not allowed");
  }
  if (!Number.isInteger(body.size) || (body.size as number) <= 0) {
    throw new ValidationError("size must be a positive integer");
  }
  if ((body.size as number) > MAX_FILE_SIZE) {
    throw new ValidationError("File is too large");
  }
  return { fileName: body.fileName, contentType: body.contentType, size: body.size as number };
}

// Picks the part size so that there are at most MAX_PARTS parts.
// Rounds up to whole MiB to keep the math in the client simple.
export function planParts(size: number, preferred = DEFAULT_PART_SIZE): UploadPlan {
  const needed = Math.ceil(size / MAX_PARTS);
  const partSize = Math.max(preferred, MIN_PART_SIZE, Math.ceil(needed / MiB) * MiB);
  return { partSize, partCount: Math.max(1, Math.ceil(size / partSize)) };
}

// "My Audiobook (Part 1).m4b" becomes "my-audiobook-part-1-.m4b" – only safe characters in the key
export function safeFileName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 100);
  return cleaned === "" ? "file" : cleaned;
}

export function assertPartNumbers(input: unknown, partCountLimit = MAX_PARTS): number[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 100) {
    throw new ValidationError("partNumbers: 1 to 100 entries");
  }
  for (const n of input) {
    if (!Number.isInteger(n) || n < 1 || n > partCountLimit) {
      throw new ValidationError(`invalid part number: ${String(n)}`);
    }
  }
  return input as number[];
}

// Length of a part: all parts have partSize, only the last one is shorter
export function partLength(plan: UploadPlan & { size: number }, partNumber: number): number {
  if (partNumber < plan.partCount) return plan.partSize;
  return plan.size - plan.partSize * (plan.partCount - 1);
}
