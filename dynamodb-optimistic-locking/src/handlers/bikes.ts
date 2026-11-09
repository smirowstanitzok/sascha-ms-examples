// src/handlers/bikes.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { RentalRejectedError, rentBike, returnBike, type Bike } from '../bike.js';
import { BikeAlreadyExistsError, BikeRepository, VersionConflictError } from '../bike-repository.js';
import { withOptimisticRetry } from '../optimistic-retry.js';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const repo = new BikeRepository(db, process.env.TABLE_NAME ?? 'bikes');

class NotFoundError extends Error {}

const json = (statusCode: number, body: unknown, headers: Record<string, string> = {}): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

const etag = (bike: Bike) => `"${bike.version}"`;

function parseBody(event: APIGatewayProxyEventV2): Record<string, unknown> {
  try {
    return JSON.parse(event.body ?? '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

const requireString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

async function loadOrFail(bikeId: string): Promise<Bike> {
  const bike = await repo.get(bikeId);
  if (!bike) throw new NotFoundError();
  return bike;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const bikeId = event.pathParameters?.bikeId ?? '';
  const body = parseBody(event);

  try {
    switch (event.routeKey) {
      case 'POST /bikes': {
        const id = requireString(body.bikeId);
        const station = requireString(body.station);
        if (!id || !station) return json(400, { message: 'bikeId and station are required' });
        const bike = await repo.create({ bikeId: id, station, status: 'AVAILABLE', ridesSinceService: 0 });
        return json(201, bike, { etag: etag(bike) });
      }

      case 'GET /bikes/{bikeId}': {
        const bike = await loadOrFail(bikeId);
        return json(200, bike, { etag: etag(bike) });
      }

      case 'POST /bikes/{bikeId}/rent': {
        const customerId = requireString(body.customerId);
        if (!customerId) return json(400, { message: 'customerId is required' });
        // Machine decision: on a conflict simply read again and decide again.
        const saved = await withOptimisticRetry(async () => {
          const bike = await loadOrFail(bikeId);
          return repo.save(rentBike(bike, customerId, new Date()));
        });
        return json(200, saved, { etag: etag(saved) });
      }

      case 'POST /bikes/{bikeId}/return': {
        const customerId = requireString(body.customerId);
        const station = requireString(body.station);
        if (!customerId || !station) return json(400, { message: 'customerId and station are required' });
        const saved = await withOptimisticRetry(async () => {
          const bike = await loadOrFail(bikeId);
          return repo.save(returnBike(bike, customerId, station));
        });
        return json(200, saved, { etag: etag(saved) });
      }

      case 'PATCH /bikes/{bikeId}': {
        // Human decision: the client has to send the version it has seen.
        const ifMatch = event.headers['if-match'];
        const expectedVersion = Number(ifMatch?.replaceAll('"', ''));
        if (!ifMatch || !Number.isInteger(expectedVersion)) {
          return json(428, { message: 'If-Match header with the version is required' });
        }
        const note = typeof body.note === 'string' ? body.note.slice(0, 500) : undefined;
        const bike = await loadOrFail(bikeId);
        if (bike.version !== expectedVersion) {
          return json(412, { message: 'Bike was changed in the meantime', current: bike }, { etag: etag(bike) });
        }
        const saved = await repo.save({ ...bike, note });
        return json(200, saved, { etag: etag(saved) });
      }

      default:
        return json(404, { message: 'Route not found' });
    }
  } catch (error) {
    if (error instanceof NotFoundError) return json(404, { message: `Bike ${bikeId} not found` });
    if (error instanceof BikeAlreadyExistsError) return json(409, { message: error.message });
    if (error instanceof RentalRejectedError) return json(409, { message: error.message, reason: error.reason });
    if (error instanceof VersionConflictError) {
      const status = event.routeKey === 'PATCH /bikes/{bikeId}' ? 412 : 409;
      return json(status, { message: error.message, current: error.current });
    }
    console.error('Unexpected error', error);
    return json(500, { message: 'Internal error' });
  }
}
