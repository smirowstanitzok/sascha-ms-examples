// src/policy.ts
import { createHash } from "node:crypto";

export const TOPICS = ["rental", "prices", "repair", "general"] as const;
export type Topic = (typeof TOPICS)[number];

/** Key terms that change an answer. They must match exactly. */
const BIKE_TYPES: Record<string, string> = {
  "e-bike": "ebike",
  ebike: "ebike",
  pedelec: "ebike",
  "cargo-bike": "cargo",
  cargobike: "cargo",
  "kids-bike": "kids",
  citybike: "city",
  "city-bike": "city",
  tandem: "tandem",
};

export function isTopic(value: unknown): value is Topic {
  return typeof value === "string" && (TOPICS as readonly string[]).includes(value);
}

/** Lowercase, drop punctuation, collapse whitespace. */
export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Personal or time-sensitive questions never go into the cache:
 * booking numbers, email addresses, “my booking”, “today”, “right now” etc.
 */
export function isCacheable(question: string): boolean {
  const q = question.toLowerCase();
  if (/\d{5,}/.test(q)) return false; // booking or customer number
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(q)) return false; // email address
  if (/\b(my|mine)\b/.test(q)) return false;
  if (/\b(today|tomorrow|right now|now|still free|available)\b/.test(q)) return false;
  return true;
}

/** Detects bike types; the result is stored as a TAG and must match exactly. */
export function detectBikeType(question: string): string {
  // English often writes compounds as two words: "cargo bike" becomes "cargo-bike".
  const words = normalizeQuestion(question)
    .replace(/\b(cargo|kids|city) bike\b/g, "$1-bike")
    .split(" ");
  const found = new Set<string>();
  for (const word of words) {
    const type = BIKE_TYPES[word];
    if (type) found.add(type);
  }
  return found.size === 0 ? "none" : [...found].sort().join("and");
}

/** Key for the exact level: same question in the same context. */
export function exactKey(scope: CacheScope, question: string): string {
  const hash = createHash("sha256").update(normalizeQuestion(question)).digest("hex");
  return `exact:${scope.topic}:${scope.kbVersion}:${hash}`;
}

export interface CacheScope {
  topic: Topic;
  kbVersion: string;
  bikeType: string;
}

/** Lowercase letters and digits only: these values end up in the query language. */
export function assertSafeTag(value: string): string {
  if (!/^[a-z0-9]{1,40}$/.test(value)) throw new Error(`Invalid tag value: ${value}`);
  return value;
}

/** Pre-filter on topic, knowledge version and bike type, then the nearest neighbor. */
export function buildLookupQuery(scope: CacheScope): string {
  const filter = [
    `@topic:{${assertSafeTag(scope.topic)}}`,
    `@kbv:{${assertSafeTag(scope.kbVersion)}}`,
    `@bike:{${assertSafeTag(scope.bikeType)}}`,
  ].join(" ");
  return `(${filter})=>[KNN 1 @embedding $vec AS distance]`;
}

/** Hit only if the cosine distance is small enough (0 = identical). */
export function isHit(distance: number | undefined, maxDistance: number): boolean {
  return distance !== undefined && Number.isFinite(distance) && distance <= maxDistance;
}

/** TTL with a random share so that not all entries expire at the same time. */
export function ttlWithJitter(baseSeconds: number, jitterRatio = 0.1, random = Math.random): number {
  const jitter = Math.floor(baseSeconds * jitterRatio * random());
  return baseSeconds - jitter;
}
