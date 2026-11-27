// src/handler.ts
import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { parseInput, reserveBike, type BikeRepository } from './reservation.ts';
import { created, internalProblem, problemResponse, toProblem, type HttpResponse } from './problem.ts';
import { InMemoryBikeRepository } from './repository.ts';

export function createReserveHandler(repo: BikeRepository) {
  return async (event: APIGatewayProxyEventV2, context: Context): Promise<HttpResponse> => {
    // The Lambda request ID is a UUID and works as a unique instance
    const instance = `urn:uuid:${context.awsRequestId}`;
    try {
      let body: unknown;
      try {
        body = JSON.parse(event.body ?? '');
      } catch {
        const issue = { pointer: '#', detail: 'Body is not valid JSON' };
        return problemResponse(toProblem({ kind: 'InvalidInput', issues: [issue] }, instance));
      }

      const input = parseInput(body);
      if (!input.ok) return problemResponse(toProblem(input.error, instance));

      const result = await reserveBike(input.value, repo);
      if (!result.ok) return problemResponse(toProblem(result.error, instance));

      return created(result.value);
    } catch (e) {
      // Details go to the log only, never into the response
      console.error(JSON.stringify({ level: 'error', instance, error: e instanceof Error ? e.stack : String(e) }));
      return problemResponse(internalProblem(instance));
    }
  };
}

export const reserve = createReserveHandler(new InMemoryBikeRepository());
