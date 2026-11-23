// src/keys.ts
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});

// Short cache: must be much shorter than the overlap window
const CACHE_MS = Number(process.env.KEY_CACHE_SECONDS ?? "60") * 1000;

export type SigningKeys = { current: string; previous?: string };

let cache: { keys: SigningKeys; loadedAt: number } | undefined;

// Reads the versions labelled "current" and "previous"
export async function loadSigningKeys(paramName: string, now = Date.now()): Promise<SigningKeys> {
  if (cache && now - cache.loadedAt < CACHE_MS) return cache.keys;

  const res = await ssm.send(
    new GetParametersCommand({
      Names: [`${paramName}:current`, `${paramName}:previous`],
      WithDecryption: true,
    }),
  );
  // A missing label ends up in InvalidParameters instead of throwing
  const bySelector = new Map((res.Parameters ?? []).map((p) => [p.Selector, p.Value]));
  const current = bySelector.get(":current");
  if (!current) throw new Error(`label "current" missing on ${paramName}`);

  const keys: SigningKeys = { current, previous: bySelector.get(":previous") };
  cache = { keys, loadedAt: now };
  return keys;
}

// Order: the current secret first
export function activeSecrets(keys: SigningKeys): string[] {
  return keys.previous ? [keys.current, keys.previous] : [keys.current];
}

export function clearKeyCache(): void {
  cache = undefined;
}
