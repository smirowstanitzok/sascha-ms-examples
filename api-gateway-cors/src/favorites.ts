// src/favorites.ts
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

// Demo storage only; in a real app this would be DynamoDB.
const favoritesBySession = new Map<string, string[]>();

const sessionFrom = (cookies: string[] = []): string | undefined =>
  cookies.map((c) => c.split('=')).find(([name]) => name.trim() === 'session')?.[1];

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  // No CORS headers here: the function URL adds them.
  // Setting them twice leads to "multiple values '*, *'" in the browser.
  const session = sessionFrom(event.cookies);
  if (!session) {
    return { statusCode: 401, body: JSON.stringify({ message: 'No session cookie' }) };
  }

  if (event.requestContext.http.method === 'PUT') {
    const body = JSON.parse(event.body ?? '{}') as { bikeIds?: string[] };
    favoritesBySession.set(session, body.bikeIds ?? []);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ favorites: favoritesBySession.get(session) ?? [] }),
  };
};
