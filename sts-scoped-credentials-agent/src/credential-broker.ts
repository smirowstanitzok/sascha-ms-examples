// src/credential-broker.ts
// Fetches scoped-down credentials via STS GetScopedCredentials and caches them.
import {
  GetScopedCredentialsCommand,
  STSClient,
  type GetScopedCredentialsCommandOutput,
} from '@aws-sdk/client-sts';
import { serializePolicy, type PolicyDocument } from './scope-policy.ts';

export interface ScopedCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}

export interface ScopeRequest {
  policy: PolicyDocument;
  durationSeconds?: number;
  description: string;
}

// Small interface instead of STSClient so tests run without AWS.
export interface StsSender {
  send(command: GetScopedCredentialsCommand): Promise<GetScopedCredentialsCommandOutput>;
}

export class ScopedCredentialBroker {
  readonly #sts: StsSender;
  readonly #refreshMarginMs: number;
  readonly #cache = new Map<string, ScopedCredentials>();

  constructor(sts: StsSender = new STSClient({}), refreshMarginMs = 60_000) {
    this.#sts = sts;
    this.#refreshMarginMs = refreshMarginMs;
  }

  async scope(request: ScopeRequest): Promise<ScopedCredentials> {
    const policy = serializePolicy(request.policy);
    const cacheKey = `${request.description}|${request.durationSeconds ?? '-'}|${policy}`;
    const cached = this.#cache.get(cacheKey);
    if (cached && cached.expiration.getTime() - Date.now() > this.#refreshMarginMs) {
      return cached;
    }

    let output: GetScopedCredentialsCommandOutput;
    try {
      output = await this.#call(policy, request.durationSeconds, request.description);
    } catch (error) {
      // The calling session expires earlier than requested:
      // without DurationSeconds we simply inherit the remaining lifetime.
      if ((error as Error).name === 'InsufficientSessionLifetimeException') {
        output = await this.#call(policy, undefined, request.description);
      } else {
        throw error;
      }
    }

    const c = output.Credentials;
    if (!c?.AccessKeyId || !c.SecretAccessKey || !c.SessionToken || !c.Expiration) {
      throw new Error('STS did not return complete credentials');
    }
    const credentials: ScopedCredentials = {
      accessKeyId: c.AccessKeyId,
      secretAccessKey: c.SecretAccessKey,
      sessionToken: c.SessionToken,
      expiration: c.Expiration,
    };
    this.#cache.set(cacheKey, credentials);
    return credentials;
  }

  #call(policy: string, durationSeconds: number | undefined, description: string) {
    return this.#sts.send(
      new GetScopedCredentialsCommand({
        Policy: policy,
        DurationSeconds: durationSeconds,
        ScopedSessionDescription: description,
      }),
    );
  }
}

// Broker that works with already scoped-down credentials,
// so an agent can give its sub-agent even fewer permissions.
export function childBroker(parent: ScopedCredentials): ScopedCredentialBroker {
  return new ScopedCredentialBroker(new STSClient({ credentials: parent }));
}
