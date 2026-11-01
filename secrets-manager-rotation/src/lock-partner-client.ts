// src/lock-partner-client.ts
// Client for the (fictional) lock API of the partner that runs the smart locks
// on the rental bikes. The API allows two active keys at the same time,
// which is exactly what we need for a rotation without downtime.

export interface LockApiSecret {
  baseUrl: string; // e.g. https://api.lockpartner.example
  accountId: string; // the bike rental's customer account at the partner
  keyId: string; // name of the key at the partner
  apiKey: string; // the actual secret value
}

export interface LockPartnerClient {
  /** Checks whether a key works (true = valid). */
  ping(secret: LockApiSecret): Promise<boolean>;
  /** Registers a new key. Authorized with the currently valid key. */
  registerKey(auth: LockApiSecret, newKey: LockApiSecret): Promise<void>;
  /** Revokes an old key. Authorized with the currently valid key. */
  revokeKey(auth: LockApiSecret, keyId: string): Promise<void>;
}

export class HttpLockPartnerClient implements LockPartnerClient {
  constructor(private readonly timeoutMs = 5000) {}

  async ping(secret: LockApiSecret): Promise<boolean> {
    const res = await this.call(secret, 'GET', `/accounts/${secret.accountId}/ping`);
    return res.status === 200;
  }

  async registerKey(auth: LockApiSecret, newKey: LockApiSecret): Promise<void> {
    const res = await this.call(auth, 'POST', `/accounts/${auth.accountId}/api-keys`, {
      keyId: newKey.keyId,
      apiKey: newKey.apiKey,
    });
    // 409 means the key is already registered (e.g. on a retry), which is fine.
    if (res.status !== 201 && res.status !== 409) {
      throw new Error(`registerKey failed: HTTP ${res.status}`);
    }
  }

  async revokeKey(auth: LockApiSecret, keyId: string): Promise<void> {
    const res = await this.call(auth, 'DELETE', `/accounts/${auth.accountId}/api-keys/${keyId}`);
    // 404 means the key no longer exists, which is fine as well.
    if (res.status !== 204 && res.status !== 404) {
      throw new Error(`revokeKey failed: HTTP ${res.status}`);
    }
  }

  private call(auth: LockApiSecret, method: string, path: string, body?: unknown): Promise<Response> {
    return fetch(new URL(path, auth.baseUrl), {
      method,
      headers: { 'x-api-key': auth.apiKey, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
  }
}
