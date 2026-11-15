// src/handler.ts
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { writeRecommendation } from "./recommend.js";
import { CacheBusyError, getOrCompute, type CacheStore } from "./stampede.js";
import { getClient, valkeyStore } from "./valkey-store.js";

// A fixed list keeps the number of cache keys (and Bedrock calls) small.
export const GENRES = ["crime", "fantasy", "nonfiction", "romance", "scifi"] as const;

export function isGenre(value: string | undefined): value is (typeof GENRES)[number] {
  return GENRES.includes(value as (typeof GENRES)[number]);
}

export async function respond(
  genre: string | undefined,
  store: CacheStore,
  compute: (genre: string) => Promise<string>,
): Promise<APIGatewayProxyResultV2> {
  if (!isGenre(genre)) {
    return json(400, { message: `Unknown genre. Allowed: ${GENRES.join(", ")}` });
  }
  try {
    const result = await getOrCompute(store, `pick:v1:${genre}`, () => compute(genre), {
      freshMs: Number(process.env.FRESH_SECONDS ?? 600) * 1000,
      staleMs: Number(process.env.STALE_SECONDS ?? 3600) * 1000,
      lockMs: 20_000,
      maxWaitMs: 3_000,
    });
    // One log line per request: lets you count the sources in Logs Insights
    console.log(JSON.stringify({ genre, source: result.source }));
    return json(200, { genre, recommendation: result.value, source: result.source });
  } catch (error) {
    if (error instanceof CacheBusyError) {
      return json(503, { message: "Recommendation is being prepared, please retry." }, { "retry-after": "2" });
    }
    throw error;
  }
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const store = valkeyStore(await getClient());
  return respond(event.pathParameters?.genre, store, writeRecommendation);
}

function json(statusCode: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    statusCode,
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  };
}
