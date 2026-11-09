// src/lock-key-cache.ts
// How a regular Lambda function (e.g. "unlock bike") reads the rotated
// key: cache it briefly and reload it once on HTTP 401.
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import type { LockApiSecret } from './lock-partner-client.js';

const sm = new SecretsManagerClient({});
const TTL_MS = 5 * 60 * 1000;
let cache: { value: LockApiSecret; expiresAt: number } | undefined;

export async function getLockKey(secretId: string, forceRefresh = false): Promise<LockApiSecret> {
  if (!forceRefresh && cache && cache.expiresAt > Date.now()) return cache.value;
  const res = await sm.send(new GetSecretValueCommand({ SecretId: secretId }));
  const value = JSON.parse(res.SecretString!) as LockApiSecret;
  cache = { value, expiresAt: Date.now() + TTL_MS };
  return value;
}

/** Runs a call and retries exactly once with a fresh key on 401. */
export async function withLockKey(
  secretId: string,
  call: (key: LockApiSecret) => Promise<Response>,
): Promise<Response> {
  const first = await call(await getLockKey(secretId));
  if (first.status !== 401) return first;
  return call(await getLockKey(secretId, true));
}
