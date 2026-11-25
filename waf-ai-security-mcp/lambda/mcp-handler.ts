// lambda/mcp-handler.ts
// Minimal MCP server (Streamable HTTP, stateless) for a fictional city library.
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const PROTOCOL_VERSION = '2025-11-25';

const BOOKS = [
  { isbn: '978-3-00-000001-1', title: 'Serverless for Beginners', available: true },
  { isbn: '978-3-00-000002-8', title: 'Cooking with Kids', available: false },
  { isbn: '978-3-00-000003-5', title: 'A History of the Railway', available: true },
];

type JsonRpcRequest = { jsonrpc: '2.0'; id?: string | number; method: string; params?: any };

export function searchBooks(searchTerm: string) {
  const s = searchTerm.toLowerCase();
  return BOOKS.filter((b) => b.title.toLowerCase().includes(s));
}

export function processRequest(req: JsonRpcRequest): object | undefined {
  switch (req.method) {
    case 'initialize':
      return ok(req.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'city-library-book-search', version: '1.0.0' },
      });
    case 'notifications/initialized':
      return undefined; // notification: no response
    case 'tools/list':
      return ok(req.id, {
        tools: [
          {
            name: 'search_books',
            description: 'Searches the city library catalog for books by title.',
            inputSchema: {
              type: 'object',
              properties: { searchTerm: { type: 'string' } },
              required: ['searchTerm'],
            },
          },
        ],
      });
    case 'tools/call': {
      if (req.params?.name !== 'search_books') return error(req.id, -32602, 'Unknown tool');
      const matches = searchBooks(String(req.params?.arguments?.searchTerm ?? ''));
      return ok(req.id, { content: [{ type: 'text', text: JSON.stringify(matches) }] });
    }
    default:
      return error(req.id, -32601, 'Method not found');
  }
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' };
  let req: JsonRpcRequest;
  try {
    req = JSON.parse(event.body ?? '');
  } catch {
    return respond(400, error(null, -32700, 'Invalid JSON'));
  }
  const result = processRequest(req);
  return result ? respond(200, result) : { statusCode: 202, body: '' };
}

function ok(id: JsonRpcRequest['id'] | null | undefined, result: object) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}
function error(id: JsonRpcRequest['id'] | null | undefined, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}
function respond(statusCode: number, body: object): APIGatewayProxyResult {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
