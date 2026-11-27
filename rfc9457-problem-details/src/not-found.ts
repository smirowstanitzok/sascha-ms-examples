// src/not-found.ts
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { problemResponse, type HttpResponse } from './problem.ts';

// Attached to the $default route, catches all unknown paths
export async function notFound(event: APIGatewayProxyEventV2): Promise<HttpResponse> {
  return problemResponse({
    type: 'about:blank',
    title: 'Not Found',
    status: 404,
    detail: `There is no endpoint for ${event.requestContext.http.method} ${event.rawPath}.`,
  });
}
