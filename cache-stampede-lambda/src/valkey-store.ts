// src/valkey-store.ts
import { GlideClusterClient, Script, ServiceType, TimeUnit } from "@valkey/valkey-glide";
import type { CacheStore } from "./stampede.js";

// Deletes the lock only if it still holds our token. redis.call also works on
// Valkey (and on Redis OSS for local tests). On Valkey 9 or later
// the single command DELIFEQ does the same.
const releaseScript = new Script(`
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0`);

let pending: Promise<GlideClusterClient> | undefined;

/** One client per Lambda execution environment; GLIDE renews the IAM token itself. */
export function getClient(): Promise<GlideClusterClient> {
  pending ??= GlideClusterClient.createClient({
    addresses: [{ host: required("CACHE_HOST"), port: 6379 }],
    useTLS: true,
    requestTimeout: 500,
    credentials: {
      username: required("CACHE_USER"),
      iamConfig: {
        clusterName: required("CACHE_NAME").toLowerCase(),
        service: ServiceType.Elasticache,
        region: required("AWS_REGION"),
      },
    },
  }).catch((error: unknown) => {
    pending = undefined; // try again on the next call
    throw error;
  });
  return pending;
}

export function valkeyStore(client: GlideClusterClient): CacheStore {
  return {
    async get(key) {
      const value = await client.get(key);
      return value === null ? null : value.toString();
    },
    async set(key, value, ttlMs) {
      await client.set(key, value, { expiry: { type: TimeUnit.Milliseconds, count: ttlMs } });
    },
    async setIfAbsent(key, value, ttlMs) {
      const result = await client.set(key, value, {
        conditionalSet: "onlyIfDoesNotExist",
        expiry: { type: TimeUnit.Milliseconds, count: ttlMs },
      });
      return result === "OK";
    },
    async deleteIfEquals(key, value) {
      const deleted = await client.invokeScript(releaseScript, { keys: [key], args: [value] });
      return deleted === 1;
    },
  };
}

export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is missing`);
  return value;
}
