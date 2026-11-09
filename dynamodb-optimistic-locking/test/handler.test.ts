// test/handler.test.ts
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { handler } from '../src/handlers/bikes.js';

const ddb = mockClient(DynamoDBDocumentClient);
const bike = { bikeId: 'b-17', station: 'harbour', status: 'AVAILABLE', ridesSinceService: 3, version: 4 };

const call = async (routeKey: string, body?: unknown, headers: Record<string, string> = {}) =>
  (await handler({
    routeKey,
    pathParameters: { bikeId: 'b-17' },
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  } as unknown as APIGatewayProxyEventV2)) as APIGatewayProxyStructuredResultV2;

beforeEach(() => {
  ddb.reset();
  ddb.on(GetCommand).resolves({ Item: bike });
  ddb.on(PutCommand).resolves({});
});

describe('bikes handler', () => {
  it('rents a bike and returns the new version as ETag', async () => {
    const res = await call('POST /bikes/{bikeId}/rent', { customerId: 'c-1' });
    expect(res.statusCode).toBe(200);
    expect(res.headers?.etag).toBe('"5"');
  });

  it('requires If-Match for PATCH', async () => {
    const res = await call('PATCH /bikes/{bikeId}', { note: 'squeaky brake' });
    expect(res.statusCode).toBe(428);
  });

  it('answers 412 if the client has seen an old version', async () => {
    const res = await call('PATCH /bikes/{bikeId}', { note: 'squeaky brake' }, { 'if-match': '"3"' });
    expect(res.statusCode).toBe(412);
    expect(ddb.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('saves the note if the version matches', async () => {
    const res = await call('PATCH /bikes/{bikeId}', { note: 'squeaky brake' }, { 'if-match': '"4"' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? '{}')).toMatchObject({ note: 'squeaky brake', version: 5 });
  });
});
