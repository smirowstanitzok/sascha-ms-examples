// src/handler.ts
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { GlideFt } from "@valkey/valkey-glide";
import { getClient } from "./valkey";
import { embed } from "./embed";
import { buildQuery, isGenre, toVectorBuffer } from "./query";

export const INDEX_NAME = "idx:books";

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const params = event.queryStringParameters ?? {};
  const question = (params.q ?? "").trim();
  if (question.length < 3 || question.length > 300) {
    return json(400, { message: "Parameter q is missing or too long (3–300 characters)" });
  }

  const genre = isGenre(params.genre) ? params.genre : undefined;
  const minYear = params.from ? Number(params.from) : undefined;
  const query = buildQuery({ genre, minYear, mustContain: params.word });

  const [client, vector] = await Promise.all([getClient(), embed(question)]);
  const [total, docs] = await GlideFt.search(client, INDEX_NAME, query, {
    params: [{ key: "vec", value: toVectorBuffer(vector) }],
    returnFields: [
      { fieldIdentifier: "title" },
      { fieldIdentifier: "author" },
      { fieldIdentifier: "year" },
      { fieldIdentifier: "distance" },
    ],
    dialect: 2,
  });

  const results = docs
    .map((doc) => {
      const fields = Object.fromEntries(doc.value.map((f) => [String(f.key), String(f.value)]));
      return {
        id: String(doc.key),
        title: fields.title,
        author: fields.author,
        year: Number(fields.year),
        distance: Number(fields.distance),
      };
    })
    .sort((a, b) => a.distance - b.distance);

  return json(200, { query, total, results });
}

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}
