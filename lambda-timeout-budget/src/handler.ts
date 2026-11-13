// src/handler.ts
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Deadline, isTimeoutError } from './deadline';
import { getMaintenanceStatus, type MaintenanceStatus } from './partner-client';

const TABLE_NAME = process.env.TABLE_NAME ?? 'bikes';
const PARTNER_BASE_URL = process.env.PARTNER_BASE_URL ?? 'https://maintenance.example.com';
const API_BUDGET_MS = Number(process.env.API_BUDGET_MS ?? '8000');

// Client outside the handler: reused across invocations
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    maxAttempts: 2,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 500,
      requestTimeout: 1500,
      throwOnRequestTimeout: true,
    }),
  }),
);

const json = (statusCode: number, body: unknown, headers: Record<string, string> = {}): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

export const handler = async (
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<APIGatewayProxyResultV2> => {
  const deadline = Deadline.fromLambdaContext(context, { reserveMs: 300, capMs: API_BUDGET_MS });
  const bikeId = event.pathParameters?.bikeId;
  if (!bikeId) return json(400, { message: 'bikeId is missing' });

  try {
    const { Item } = await ddb.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { pk: `BIKE#${bikeId}` } }),
      { abortSignal: deadline.signalFor('dynamodb', 2000) },
    );
    if (!Item) return json(404, { message: 'Bike not found' });

    let maintenance: MaintenanceStatus = { state: 'unknown' };
    let degraded = false;
    try {
      maintenance = await getMaintenanceStatus(bikeId, deadline, { baseUrl: PARTNER_BASE_URL });
    } catch (err) {
      // Partner too slow or broken: an honest partial answer beats a 503 from API Gateway
      degraded = true;
      console.warn(JSON.stringify({ msg: 'maintenance_status_missing', bikeId, error: (err as Error).name, remainingMs: deadline.remainingMs() }));
    }

    return json(200, {
      bikeId,
      station: Item.station,
      available: Boolean(Item.available) && maintenance.state !== 'in_repair',
      maintenance: maintenance.state,
      degraded,
    });
  } catch (err) {
    if (isTimeoutError(err)) {
      console.warn(JSON.stringify({ msg: 'time_budget_exhausted', bikeId, remainingMs: deadline.remainingMs() }));
      return json(503, { message: 'Too slow right now, please try again in a moment' }, { 'retry-after': '2' });
    }
    throw err;
  }
};
