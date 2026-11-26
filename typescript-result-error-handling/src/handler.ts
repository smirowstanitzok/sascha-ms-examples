// src/handler.ts
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { parseInput, reserveBike } from './reservation.ts';
import { created, toHttpError, type HttpResponse } from './http.ts';
import { InMemoryBikeRepository } from './repository.ts';

const repo = new InMemoryBikeRepository();

export async function handler(event: APIGatewayProxyEventV2): Promise<HttpResponse> {
  let body: unknown;
  try {
    body = JSON.parse(event.body ?? '');
  } catch {
    return toHttpError({ kind: 'InvalidInput', message: 'Body is not valid JSON' });
  }

  const input = parseInput(body);
  if (!input.ok) return toHttpError(input.error);

  const result = await reserveBike(input.value, repo);
  if (!result.ok) return toHttpError(result.error);

  return created(result.value);
}
