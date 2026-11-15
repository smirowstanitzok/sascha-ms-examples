// src/semantic-cache.ts
import { randomUUID } from "node:crypto";
import { GlideFt, TimeUnit, type GlideClusterClient } from "@valkey/valkey-glide";
import { toVectorBuffer } from "./embed";
import { buildLookupQuery, exactKey, type CacheScope } from "./policy";

export const INDEX_NAME = "idx:answers";
export const KEY_PREFIX = "answer:";

export interface SemanticMatch {
  answer: string;
  question: string;
  distance: number;
}

/** Level 1: exactly the same question, no embedding at all. */
export async function lookupExact(client: GlideClusterClient, scope: CacheScope, question: string) {
  const value = await client.get(exactKey(scope, question));
  return value === null ? undefined : String(value);
}

/** Level 2: most similar stored question in the same context. */
export async function lookupSemantic(
  client: GlideClusterClient,
  scope: CacheScope,
  vector: number[],
): Promise<SemanticMatch | undefined> {
  const [, docs] = await GlideFt.search(client, INDEX_NAME, buildLookupQuery(scope), {
    params: [{ key: "vec", value: toVectorBuffer(vector) }],
    returnFields: [
      { fieldIdentifier: "question" },
      { fieldIdentifier: "answer" },
      { fieldIdentifier: "distance" },
    ],
    dialect: 2,
  });
  const doc = docs[0];
  if (!doc) return undefined;
  const fields = Object.fromEntries(doc.value.map((f) => [String(f.key), String(f.value)]));
  return { question: fields.question, answer: fields.answer, distance: Number(fields.distance) };
}

/** Stores both levels with the same time to live. */
export async function store(
  client: GlideClusterClient,
  scope: CacheScope,
  question: string,
  vector: number[],
  answer: string,
  ttlSeconds: number,
): Promise<void> {
  const key = `${KEY_PREFIX}${randomUUID()}`;
  await client.hset(key, [
    { field: "question", value: question },
    { field: "answer", value: answer },
    { field: "topic", value: scope.topic },
    { field: "kbv", value: scope.kbVersion },
    { field: "bike", value: scope.bikeType },
    { field: "embedding", value: toVectorBuffer(vector) },
  ]);
  await client.expire(key, ttlSeconds);
  await client.set(exactKey(scope, question), answer, {
    expiry: { type: TimeUnit.Seconds, count: ttlSeconds },
  });
}
