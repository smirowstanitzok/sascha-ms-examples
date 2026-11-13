// test/token-client.test.ts
import { describe, expect, it } from 'vitest';
import { buildClientCredentialsBody, buildExchangeBody, decodeJwtPayload, GRANT_TOKEN_EXCHANGE } from '../src/token-client.js';

describe('buildExchangeBody', () => {
  it('builds a delegation with an actor token', () => {
    const body = buildExchangeBody({ subjectToken: 'nutzer', actorToken: 'agent', audience: 'bestellungen', scopes: ['bestellungen/lesen'] });
    expect(body.get('grant_type')).toBe(GRANT_TOKEN_EXCHANGE);
    expect(body.get('audience')).toBe('bestellungen');
    expect(body.get('scope')).toBe('bestellungen/lesen');
    expect(body.get('actor_token_type')).toBe('urn:ietf:params:oauth:token-type:access_token');
  });

  it('omits the actor token for impersonation', () => {
    const body = buildExchangeBody({ subjectToken: 'nutzer', audience: 'bestellungen', scopes: ['bestellungen/lesen'] });
    expect(body.has('actor_token')).toBe(false);
  });

  it('requires at least one scope', () => {
    expect(() => buildExchangeBody({ subjectToken: 'x', audience: 'bestellungen', scopes: [] })).toThrow(/scope/);
  });
});

describe('helpers', () => {
  it('joins client credentials scopes with spaces', () => {
    expect(buildClientCredentialsBody(['a/b', 'c/d']).toString()).toBe('grant_type=client_credentials&scope=a%2Fb+c%2Fd');
  });

  it('reads the payload of a JWT', () => {
    const payload = Buffer.from(JSON.stringify({ sub: 'u1', act: { sub: 'agent-1' } })).toString('base64url');
    expect(decodeJwtPayload(`header.${payload}.signature`)).toEqual({ sub: 'u1', act: { sub: 'agent-1' } });
  });
});
