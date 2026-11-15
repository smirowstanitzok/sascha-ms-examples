// src/handler.ts
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { getClient, required } from "./valkey";
import { embed } from "./embed";
import { askModel } from "./answer";
import { recordRequest } from "./metrics";
import { detectBikeType, isCacheable, isHit, isTopic, ttlWithJitter, type CacheScope } from "./policy";
import { lookupExact, lookupSemantic, store } from "./semantic-cache";

const MAX_DISTANCE = Number(process.env.MAX_DISTANCE ?? "0.1");
const TTL_SECONDS = Number(process.env.TTL_SECONDS ?? "82800"); // 23 hours

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  let body: { question?: unknown; topic?: unknown };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { message: "Body is not valid JSON" });
  }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length < 5 || question.length > 500) {
    return json(400, { message: "Field question is missing or too long (5–500 characters)" });
  }
  const topic = isTopic(body.topic) ? body.topic : "general";

  // Personal questions always go straight to the model (or better: to a business system).
  if (!isCacheable(question)) {
    const fresh = await askModel(question);
    recordRequest("no-cache");
    return json(200, { answer: fresh.text, source: "no-cache" });
  }

  const scope: CacheScope = { topic, kbVersion: required("KB_VERSION"), bikeType: detectBikeType(question) };
  const client = await getClient();

  const exact = await lookupExact(client, scope, question);
  if (exact !== undefined) {
    recordRequest("exact");
    return json(200, { answer: exact, source: "cache-exact" });
  }

  const vector = await embed(question);
  const match = await lookupSemantic(client, scope, vector);
  if (match && isHit(match.distance, MAX_DISTANCE)) {
    recordRequest("semantic", match.distance);
    return json(200, { answer: match.answer, source: "cache-semantic", distance: match.distance });
  }

  const fresh = await askModel(question);
  if (fresh.text.length > 0) {
    await store(client, scope, question, vector, fresh.text, ttlWithJitter(TTL_SECONDS));
  }
  recordRequest("model", match?.distance);
  return json(200, { answer: fresh.text, source: "model", nearestDistance: match?.distance ?? null });
}

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}
