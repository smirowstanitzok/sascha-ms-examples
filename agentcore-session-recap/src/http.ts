// src/http.ts
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { assertId } from "./memory.ts";

export type HttpEvent = APIGatewayProxyEventV2WithJWTAuthorizer;

// In production the customer ID comes from the token (claim "sub").
// The header fallback exists only for the dev stage (DEMO_AUTH=true).
export function customerIdFrom(event: HttpEvent): string {
  const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (typeof sub === "string") return assertId(sub, "customerId");
  if (process.env.DEMO_AUTH === "true") return assertId(event.headers?.["x-demo-customer"], "customerId");
  throw new Error("Unauthenticated");
}

export function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

// Maps our own validation errors to 4xx; everything else stays a 500.
export function clientError(error: unknown) {
  const message = (error as Error)?.message ?? "";
  if (message === "Unauthenticated" || message === "Invalid customerId") return json(401, { error: "unauthenticated" });
  if (message.startsWith("Invalid ")) return json(400, { error: message });
  throw error;
}
