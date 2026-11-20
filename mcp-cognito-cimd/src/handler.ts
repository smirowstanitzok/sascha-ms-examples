// src/handler.ts
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { authorize, createVerifier, loadConfig, protectedResourceMetadata, type AuthConfig } from "./auth.ts";
import { handleRpc } from "./mcp.ts";

type Verifier = { verify(token: string): Promise<Record<string, unknown>> };

export function buildHandler(cfg: AuthConfig, verifier: Verifier) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    const { method, path } = event.requestContext.http;

    if (method === "GET" && path.startsWith("/.well-known/oauth-protected-resource")) {
      return json(200, protectedResourceMetadata(cfg), { "Cache-Control": "max-age=3600" });
    }

    if (path !== "/mcp") return json(404, { error: "not_found" });
    if (method !== "POST") return json(405, { error: "method_not_allowed" }, { Allow: "POST" });

    const auth = await authorize(verifier, cfg, event.headers.authorization);
    if (!auth.ok) {
      return json(auth.status, { error: "unauthorized" }, { "WWW-Authenticate": auth.wwwAuthenticate });
    }

    let body: unknown;
    try {
      const raw = event.isBase64Encoded ? Buffer.from(event.body ?? "", "base64").toString() : event.body ?? "";
      body = JSON.parse(raw);
    } catch {
      return json(400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    }

    const response = handleRpc(body as Parameters<typeof handleRpc>[0], auth.subject);
    if (!response) return { statusCode: 202 };
    return json(200, response);
  };
}

function json(statusCode: number, body: unknown, headers: Record<string, string> = {}) {
  return { statusCode, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) };
}

let cached: ReturnType<typeof buildHandler> | undefined;

export const main = async (event: APIGatewayProxyEventV2) => {
  if (!cached) {
    const cfg = loadConfig();
    cached = buildHandler(cfg, createVerifier(cfg));
  }
  return cached(event);
};
