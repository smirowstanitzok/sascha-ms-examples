// src/claims.ts
import type { APIGatewayProxyEvent } from 'aws-lambda';

// The JWT authorizer passes claims on with their JSON type
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type Claims = Record<string, JsonValue>;

export function readClaims(event: APIGatewayProxyEvent): Claims {
  const claims = event.requestContext.authorizer?.claims;
  if (!claims || typeof claims !== 'object') {
    // Only happens if the method is reachable without an authorizer
    throw new Error('No claims found. Is the JWT authorizer attached to this method?');
  }
  return claims as Claims;
}

// scope (OAuth 2.0) or scp (e.g. Okta), as text or as a list
export function scopesOf(claims: Claims): string[] {
  const raw = claims.scope ?? claims.scp;
  if (typeof raw === 'string') return raw.split(' ').filter(Boolean);
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === 'string');
  return [];
}

// Who is calling? client_id for machine tokens, otherwise sub
export function callerOf(claims: Claims): string {
  const id = claims.client_id ?? claims.azp ?? claims.sub;
  return typeof id === 'string' ? id : 'unknown';
}
