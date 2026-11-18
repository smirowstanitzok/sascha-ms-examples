// src/create-rental.ts
import { randomUUID } from 'node:crypto';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { callerOf, readClaims, scopesOf } from './claims';

const json = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const claims = readClaims(event);

  // Second line of defense: API Gateway has already checked the scope,
  // but the handler does not rely on it blindly
  const scopes = scopesOf(claims);
  if (!scopes.some((s) => s.endsWith('rentals:write'))) {
    return json(403, { message: 'Scope rentals:write is missing' });
  }

  let bikeId: unknown;
  try {
    bikeId = JSON.parse(event.body ?? '{}').bikeId;
  } catch {
    return json(400, { message: 'Body is not valid JSON' });
  }
  if (typeof bikeId !== 'string' || bikeId.length === 0) {
    return json(400, { message: 'bikeId is missing' });
  }

  return json(201, {
    rentalId: randomUUID(),
    bikeId,
    bookedBy: callerOf(claims),
    startedAt: new Date().toISOString(),
  });
}
