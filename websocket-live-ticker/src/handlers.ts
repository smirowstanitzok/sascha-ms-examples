// src/handlers.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type {
  APIGatewayProxyResult,
  APIGatewayProxyWebsocketEventV2,
} from 'aws-lambda';
import { broadcast } from './broadcast.ts';
import { createConnectionStore } from './connections.ts';
import { createApiGatewaySender } from './sender.ts';

const store = createConnectionStore(
  DynamoDBDocumentClient.from(new DynamoDBClient({})),
  process.env.TABLE_NAME!,
);

const MATCH_ID = /^[a-z0-9-]{3,40}$/;

// For $connect, API Gateway also passes the query string parameters.
type ConnectEvent = APIGatewayProxyWebsocketEventV2 & {
  queryStringParameters?: Record<string, string | undefined>;
};

export async function connect(event: ConnectEvent): Promise<APIGatewayProxyResult> {
  const matchId = event.queryStringParameters?.match ?? '';
  if (!MATCH_ID.test(matchId)) {
    // Anything other than 2xx rejects the connection.
    return { statusCode: 400, body: 'Parameter "match" is missing or invalid' };
  }
  await store.add(event.requestContext.connectionId, matchId);
  return { statusCode: 200, body: 'connected' };
}

export async function disconnect(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResult> {
  await store.remove(event.requestContext.connectionId);
  return { statusCode: 200, body: 'disconnected' };
}

// Route "ping": keeps the connection below the 10-minute idle limit.
export async function ping(): Promise<APIGatewayProxyResult> {
  return { statusCode: 200, body: JSON.stringify({ type: 'pong', at: new Date().toISOString() }) };
}

export interface TickerEvent {
  matchId: string;
  minute: number;
  text: string;
  score?: string;
}

// Not called through the WebSocket, but invoked directly (protected by IAM).
export async function publish(event: TickerEvent) {
  if (!MATCH_ID.test(event.matchId) || !event.text) {
    throw new Error('matchId and text are required');
  }
  const ids = await store.listByMatch(event.matchId);
  const sender = createApiGatewaySender(process.env.CALLBACK_URL!);
  const report = await broadcast(ids, { type: 'ticker', ...event }, sender);

  // Clean up stale connections right away.
  await Promise.all(report.gone.map((id) => store.remove(id)));

  console.log(JSON.stringify({ matchId: event.matchId, receivers: ids.length, ...report }));
  return { receivers: ids.length, sent: report.sent, gone: report.gone.length, failed: report.failed.length };
}
