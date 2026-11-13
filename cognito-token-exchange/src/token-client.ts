// src/token-client.ts
// Small client for the Cognito token endpoint: client credentials and token exchange (RFC 8693)

export const GRANT_TOKEN_EXCHANGE = 'urn:ietf:params:oauth:grant-type:token-exchange';
export const TYPE_ACCESS_TOKEN = 'urn:ietf:params:oauth:token-type:access_token';

export interface ClientConfig {
  tokenUrl: string; // https://<prefix>.auth.<region>.amazoncognito.com/oauth2/token
  clientId: string;
  clientSecret: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  issued_token_type?: string;
}

export interface ExchangeRequest {
  subjectToken: string; // the user's access token
  actorToken?: string; // the agent's token -> act claim (delegation)
  audience: string; // resource server, e.g. "bestellungen"
  scopes: string[]; // requested, narrower scopes
}

export function buildExchangeBody(req: ExchangeRequest): URLSearchParams {
  if (req.scopes.length === 0) throw new Error('Specify at least one scope');
  const body = new URLSearchParams({
    grant_type: GRANT_TOKEN_EXCHANGE,
    subject_token: req.subjectToken,
    subject_token_type: TYPE_ACCESS_TOKEN,
    audience: req.audience,
    scope: req.scopes.join(' '),
  });
  if (req.actorToken) {
    body.set('actor_token', req.actorToken);
    body.set('actor_token_type', TYPE_ACCESS_TOKEN);
  }
  return body;
}

export function buildClientCredentialsBody(scopes: string[]): URLSearchParams {
  return new URLSearchParams({ grant_type: 'client_credentials', scope: scopes.join(' ') });
}

function basicAuth(cfg: ClientConfig): string {
  return 'Basic ' + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
}

export async function requestToken(cfg: ClientConfig, body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuth(cfg),
    },
    body,
  });
  const json = (await res.json()) as TokenResponse & { error?: string };
  if (!res.ok) {
    // pass on the error without any token contents
    throw new Error(`Token endpoint returned ${res.status}: ${json.error ?? 'unknown error'}`);
  }
  return json;
}

// Read the payload of a JWT WITHOUT checking the signature.
// Only use this when an authorizer (e.g. the API Gateway JWT authorizer) has already verified it.
export function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new Error('Not a valid JWT');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}
