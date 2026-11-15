// src/bikes.ts
import { randomUUID } from 'node:crypto';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

interface Bike {
  id: string;
  model: string;
  available: boolean;
}

const bikes: Bike[] = [
  { id: 'bike-01', model: 'City bike, 7 gears', available: true },
  { id: 'bike-02', model: 'E-bike Trekking', available: false },
  { id: 'bike-03', model: 'Cargo bike', available: true },
];

// Important: no Access-Control-* headers here.
// The HTTP API adds them from the CORS configuration and ignores our own anyway.
const json = (statusCode: number, body: unknown, extra: Record<string, string> = {}): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', ...extra },
  body: JSON.stringify(body),
});

export const listBikes = async (): Promise<APIGatewayProxyStructuredResultV2> => json(200, { bikes });

export const createBooking = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  const raw = event.isBase64Encoded && event.body ? Buffer.from(event.body, 'base64').toString('utf8') : event.body ?? '';

  let input: { bikeId?: unknown };
  try {
    input = JSON.parse(raw || '{}');
  } catch {
    return json(400, { message: 'Body is not valid JSON' });
  }

  const bike = bikes.find((b) => b.id === input.bikeId);
  if (!bike) {
    return json(400, { message: 'Unknown bikeId' });
  }
  if (!bike.available) {
    return json(409, { message: `${bike.model} is already booked` });
  }

  const bookingId = randomUUID();
  return json(201, { bookingId, bikeId: bike.id }, { 'X-Booking-Id': bookingId });
};
