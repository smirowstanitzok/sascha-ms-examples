// functions/api.ts
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

const books = [
  { id: 'b1', title: 'The Little Serverless Garden', available: true },
  { id: 'b2', title: 'Cooking with Queues', available: false },
];

const json = (
  statusCode: number,
  body: unknown,
  cookies?: string[],
): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
  cookies,
});

// Reads a cookie value from the cookies array of the HTTP API (payload 2.0)
const readCookie = (event: APIGatewayProxyEventV2, name: string) =>
  event.cookies
    ?.map((c) => c.split('='))
    .find(([key]) => key.trim() === name)?.[1];

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const route = `${event.requestContext.http.method} ${event.rawPath}`;

  switch (route) {
    case 'GET /api/books':
      return json(200, { books });

    case 'POST /api/session': {
      const reader = 'reader-' + Math.random().toString(36).slice(2, 8);
      // Same origin: SameSite=Strict works, no third-party cookie needed
      const cookie = `reader=${reader}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`;
      return json(201, { reader }, [cookie]);
    }

    case 'GET /api/me': {
      const reader = readCookie(event, 'reader');
      return reader
        ? json(200, { reader })
        : json(401, { message: 'Not signed in' });
    }

    default:
      return json(404, { message: `Unknown route: ${route}` });
  }
};
