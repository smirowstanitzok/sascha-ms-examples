// src/auth.ts
import { JwtVerifier } from "aws-jwt-verify";
import { JwtInvalidScopeError } from "aws-jwt-verify/error";

export interface AuthConfig {
  issuer: string;        // https://cognito-idp.<region>.amazonaws.com/<userPoolId>
  resource: string;      // public URL of the MCP endpoint, e.g. https://abc.execute-api.eu-central-1.amazonaws.com/mcp
  requiredScope: string; // e.g. bookstore-mcp/tools.read
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const { ISSUER, MCP_RESOURCE, REQUIRED_SCOPE } = env;
  if (!ISSUER || !MCP_RESOURCE || !REQUIRED_SCOPE) {
    throw new Error("ISSUER, MCP_RESOURCE and REQUIRED_SCOPE must be set");
  }
  return { issuer: ISSUER, resource: MCP_RESOURCE, requiredScope: REQUIRED_SCOPE };
}

// Protected Resource Metadata (RFC 9728): tells the MCP client where to get tokens
export function protectedResourceMetadata(cfg: AuthConfig) {
  return {
    resource: cfg.resource,
    authorization_servers: [cfg.issuer],
    scopes_supported: [cfg.requiredScope],
    bearer_methods_supported: ["header"],
    resource_name: "Bookstore MCP (example)",
  };
}

export function metadataUrl(cfg: AuthConfig): string {
  const url = new URL(cfg.resource);
  // RFC 9728: the endpoint path is appended to the well-known path
  return `${url.origin}/.well-known/oauth-protected-resource${url.pathname}`;
}

export function challenge(cfg: AuthConfig, error?: "invalid_token" | "insufficient_scope"): string {
  const parts = [`resource_metadata="${metadataUrl(cfg)}"`, `scope="${cfg.requiredScope}"`];
  if (error) parts.unshift(`error="${error}"`);
  return `Bearer ${parts.join(", ")}`;
}

export function createVerifier(cfg: AuthConfig) {
  return JwtVerifier.create({
    issuer: cfg.issuer,
    audience: cfg.resource, // set in the aud claim via resource binding (RFC 8707)
    scope: cfg.requiredScope,
    jwksUri: `${cfg.issuer}/.well-known/jwks.json`,
    customJwtCheck: ({ payload }) => {
      if (payload.token_use !== "access") throw new Error("Only access tokens are allowed");
    },
  });
}

export type AuthResult =
  | { ok: true; subject: string; clientId: string }
  | { ok: false; status: 401 | 403; wwwAuthenticate: string };

export async function authorize(
  verifier: { verify(token: string): Promise<Record<string, unknown>> },
  cfg: AuthConfig,
  authorizationHeader: string | undefined,
): Promise<AuthResult> {
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader ?? "");
  if (!match) return { ok: false, status: 401, wwwAuthenticate: challenge(cfg) };
  try {
    const payload = await verifier.verify(match[1]);
    return { ok: true, subject: String(payload.sub), clientId: String(payload.client_id ?? "") };
  } catch (err) {
    if (err instanceof JwtInvalidScopeError) {
      return { ok: false, status: 403, wwwAuthenticate: challenge(cfg, "insufficient_scope") };
    }
    return { ok: false, status: 401, wwwAuthenticate: challenge(cfg, "invalid_token") };
  }
}
