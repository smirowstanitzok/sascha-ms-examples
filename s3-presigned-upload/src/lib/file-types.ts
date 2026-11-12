// src/lib/file-types.ts
// Allowed image types with file extension and “magic bytes” (the first bytes of every file)
export const ERLAUBTE_TYPEN = {
  "image/jpeg": { endung: "jpg" },
  "image/png": { endung: "png" },
  "image/webp": { endung: "webp" },
} as const;

export type BildTyp = keyof typeof ERLAUBTE_TYPEN;

export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function istErlaubterTyp(contentType: unknown): contentType is BildTyp {
  return typeof contentType === "string" && contentType in ERLAUBTE_TYPEN;
}

// Detects the real file type from the start of the file – regardless of the declared Content-Type
export function erkenneTyp(kopf: Uint8Array): BildTyp | undefined {
  const b = (i: number) => kopf[i];
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((wert, i) => b(i) === wert)) return "image/png";
  const ascii = (start: number, ende: number) =>
    String.fromCharCode(...kopf.subarray(start, ende));
  if (kopf.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return "image/webp";
  }
  return undefined;
}
