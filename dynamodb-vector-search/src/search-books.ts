// src/search-books.ts
import { DynamoDBClient, SearchVectorsCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { embed } from './embed.ts';
import { buildSearchRequest, type SearchFilter } from './search-request.ts';

const dynamodb = new DynamoDBClient({});

const optionalNumber = (value?: string) => (value ? Number(value) : undefined);

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const q = event.queryStringParameters ?? {};
  if (!q.q || !q.genre) {
    return { statusCode: 400, body: JSON.stringify({ message: 'q and genre are required' }) };
  }

  const filter: SearchFilter = {
    genre: q.genre,
    langs: q.lang ? q.lang.split(',') : undefined,
    maxPrice: optionalNumber(q.maxPrice),
    minYear: optionalNumber(q.minYear),
  };

  const vector = await embed(q.q);
  const response = await dynamodb.send(
    new SearchVectorsCommand(
      buildSearchRequest(process.env.BOOKS_TABLE!, process.env.BOOKS_INDEX!, vector, filter, 5),
    ),
  );

  const results = (response.SearchResults ?? []).map((result) => ({
    ...unmarshall(result.Item ?? {}),
    score: result.Score, // COSINE: 0 = same direction, lower is better
  }));

  console.log(JSON.stringify({ query: q.q, hits: results.length, consumed: response.ConsumedCapacity }));
  return { statusCode: 200, body: JSON.stringify(results) };
}
