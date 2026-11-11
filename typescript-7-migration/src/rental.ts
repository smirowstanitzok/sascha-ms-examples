// src/rental.ts
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { rentalPriceCents } from '@shared/pricing';

const STATION = process.env.STATION_NAME ?? 'Central Station';

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const body = JSON.parse(event.body ?? '{}') as { hours?: number };
  try {
    const priceCents = rentalPriceCents(body.hours ?? 1);
    return json(200, { station: STATION, priceCents });
  } catch (err) {
    return json(400, { message: (err as Error).message });
  }
};

function json(statusCode: number, payload: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  };
}
