// src/query.ts
import type { QueryVectorsCommandInput } from '@aws-sdk/client-s3vectors';

export interface SearchOptions {
  bucket: string;
  index: string;
  text: string;
  vector?: number[];
  category?: string;
  topK?: number;
}

// Builds the request: hybrid with a vector, full-text only without one.
export function buildQuery(options: SearchOptions): QueryVectorsCommandInput {
  const text = options.text.trim().slice(0, 1024);
  if (text.length === 0) {
    throw new Error('Search text is missing');
  }

  return {
    vectorBucketName: options.bucket,
    indexName: options.index,
    topK: Math.min(Math.max(options.topK ?? 5, 1), 50),
    ...(options.vector ? { queryVector: { float32: options.vector } } : {}),
    queryTexts: [
      { text, metadataKey: 'title' },
      { text, metadataKey: 'body' },
    ],
    ...(options.category ? { filter: { category: { $eq: options.category } } } : {}),
    returnMetadata: true,
    returnDistance: true,
    returnScores: true,
  };
}
