// test/handler.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createSign } from "node:crypto";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createVerifier, type AuthConfig } from "../src/auth.ts";
import { buildHandler } from "../src/handler.ts";

const cfg: AuthConfig = {
  issuer: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_Beispiel",
  resource: "https://mcp.example.com/mcp",
  requiredScope: "bookstore-mcp/tools.read",
};

// Own key pair instead of Cognito: the test runs without AWS access
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key", alg: "RS256", use: "sig" };
const verifier = createVerifier(cfg);
verifier.cacheJwks({ keys: [jwk as never] });
const handler = buildHandler(cfg, verifier);

function token(claims: Record<string, unknown>): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "RS256", kid: "test-key", typ: "JWT" });
  const body = b64({
    iss: cfg.issuer, aud: cfg.resource, token_use: "access", sub: "user-123",
    client_id: "https://assistant.example.com/oauth/client-metadata.json",
    scope: "openid bookstore-mcp/tools.read", iat: now, exp: now + 300, ...claims,
  });
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(privateKey).toString("base64url");
  return `${head}.${body}.${sig}`;
}

function event(method: string, path: string, opts: { auth?: string; body?: object } = {}) {
  return {
    requestContext: { http: { method, path } },
    headers: opts.auth ? { authorization: opts.auth } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2;
}

const listTools = { jsonrpc: "2.0", id: 1, method: "tools/list" };

test("returns protected resource metadata with Cognito as authorization server", async () => {
  const res = await handler(event("GET", "/.well-known/oauth-protected-resource/mcp"));
  assert.equal(res.statusCode, 200);
  const meta = JSON.parse(res.body as string);
  assert.equal(meta.resource, cfg.resource);
  assert.deepEqual(meta.authorization_servers, [cfg.issuer]);
});

test("without token: 401 pointing to the metadata", async () => {
  const res = await handler(event("POST", "/mcp", { body: listTools }));
  assert.equal(res.statusCode, 401);
  assert.match(String(res.headers?.["WWW-Authenticate"]), /resource_metadata="https:\/\/mcp\.example\.com\/\.well-known\/oauth-protected-resource\/mcp"/);
});

test("token for a different audience is rejected", async () => {
  const res = await handler(event("POST", "/mcp", { auth: `Bearer ${token({ aud: "https://other-service.example.com" })}`, body: listTools }));
  assert.equal(res.statusCode, 401);
  assert.match(String(res.headers?.["WWW-Authenticate"]), /error="invalid_token"/);
});

test("missing scope: 403 insufficient_scope", async () => {
  const res = await handler(event("POST", "/mcp", { auth: `Bearer ${token({ scope: "openid" })}`, body: listTools }));
  assert.equal(res.statusCode, 403);
  assert.match(String(res.headers?.["WWW-Authenticate"]), /error="insufficient_scope"/);
});

test("ID token instead of access token is rejected", async () => {
  const res = await handler(event("POST", "/mcp", { auth: `Bearer ${token({ token_use: "id" })}`, body: listTools }));
  assert.equal(res.statusCode, 401);
});

test("valid token: tool call returns results", async () => {
  const res = await handler(event("POST", "/mcp", {
    auth: `Bearer ${token({})}`,
    body: { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search_books", arguments: { keyword: "serverless" } } },
  }));
  assert.equal(res.statusCode, 200);
  const rpc = JSON.parse(res.body as string);
  assert.match(rpc.result.content[0].text, /Serverless for Beginners by A\. Example: 4 in stock/);
});
