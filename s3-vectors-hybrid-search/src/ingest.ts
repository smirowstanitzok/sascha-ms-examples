// src/ingest.ts
import { S3VectorsClient, PutVectorsCommand, type PutInputVector } from '@aws-sdk/client-s3vectors';
import { embed } from './embed.ts';

export interface HelpArticle {
  id: string;
  title: string;
  body: string;
  category: string;
}

const s3vectors = new S3VectorsClient({});

export async function handler(event: { articles: HelpArticle[] }) {
  const vectors: PutInputVector[] = [];

  for (const article of event.articles) {
    const embedding = await embed(`${article.title}\n\n${article.body}`);
    vectors.push({
      key: article.id,
      data: { float32: embedding },
      // title and body are configured for full-text search,
      // category stays a regular filter.
      metadata: { title: article.title, body: article.body, category: article.category },
    });
  }

  // PutVectors accepts at most 500 vectors per call.
  for (let i = 0; i < vectors.length; i += 500) {
    await s3vectors.send(
      new PutVectorsCommand({
        vectorBucketName: process.env.VECTOR_BUCKET,
        indexName: process.env.VECTOR_INDEX,
        vectors: vectors.slice(i, i + 500),
      }),
    );
  }

  return { stored: vectors.length };
}
