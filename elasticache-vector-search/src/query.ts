// src/query.ts
export const GENRES = ["crime", "novel", "nonfiction", "fantasy", "children"] as const;
export type Genre = (typeof GENRES)[number];

export interface SearchFilter {
  genre?: Genre;
  minYear?: number;
  mustContain?: string;
}

export function isGenre(value: string | undefined): value is Genre {
  return value !== undefined && (GENRES as readonly string[]).includes(value);
}

/** Removes everything that has a special meaning in the query syntax. */
export function cleanWords(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .slice(0, 5);
}

/** Builds the query: optional pre-filter, then KNN over the embedding. */
export function buildQuery(filter: SearchFilter, k = 5): string {
  const parts: string[] = [];
  if (filter.genre) parts.push(`@genre:{${filter.genre}}`);
  if (filter.minYear !== undefined && Number.isFinite(filter.minYear)) {
    parts.push(`@year:[${Math.trunc(filter.minYear)} +inf]`);
  }
  for (const word of cleanWords(filter.mustContain ?? "")) {
    parts.push(`@description:${word}`);
  }
  const prefilter = parts.length > 0 ? `(${parts.join(" ")})` : "*";
  return `${prefilter}=>[KNN ${k} @embedding $vec AS distance]`;
}

/** Valkey expects FLOAT32 values as little-endian bytes. */
export function toVectorBuffer(vector: number[]): Buffer {
  const floats = new Float32Array(vector);
  const bytes = Buffer.alloc(floats.length * 4);
  floats.forEach((value, i) => bytes.writeFloatLE(value, i * 4));
  return bytes;
}
