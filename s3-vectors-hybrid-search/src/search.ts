// src/search.ts
import { S3VectorsClient, QueryVectorsCommand } from '@aws-sdk/client-s3vectors';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { embed } from './embed.ts';
import { buildQuery } from './query.ts';

const s3vectors = new S3VectorsClient({});

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const q = event.queryStringParameters?.q ?? '';
  const mode = event.queryStringParameters?.mode === 'text' ? 'text' : 'hybrid';
  const category = event.queryStringParameters?.category;

  if (q.trim().length === 0) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Parameter q is missing' }) };
  }

  // For full-text-only search we skip the call to the embedding model.
  const vector = mode === 'hybrid' ? await embed(q) : undefined;
  const result = await s3vectors.send(
    new QueryVectorsCommand(
      buildQuery({
        bucket: process.env.VECTOR_BUCKET!,
        index: process.env.VECTOR_INDEX!,
        text: q,
        vector,
        category,
      }),
    ),
  );

  const hits = (result.vectors ?? []).map((v) => ({
    id: v.key,
    title: (v.metadata as Record<string, unknown> | undefined)?.title,
    fused: v.scores?.fused,
    bm25: v.scores?.bm25Scores?.map((s) => `${s.metadataKey}: ${s.score?.toFixed(2)}`),
    distance: v.scores?.vectorDistance ?? v.distance,
  }));

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode, hits }),
  };
}
