// src/price-handler.ts
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { calculateRentalPrice, isBoatType } from './pricing.js';

const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const boat = event.queryStringParameters?.boat ?? '';
  const hours = Number(event.queryStringParameters?.hours ?? 'NaN');

  // Invalid input is the caller's fault: answer with 400, do not throw.
  if (!isBoatType(boat) || !Number.isInteger(hours) || hours < 1 || hours > 72) {
    return json(400, { message: 'Use ?boat=kayak|canoe|sup&hours=1..72' });
  }

  // Unexpected errors are thrown on purpose: they show up in the
  // Lambda "Errors" metric that the canary alarm watches.
  const priceCents = calculateRentalPrice(boat, hours);
  return json(200, { boat, hours, priceCents, version: process.env.AWS_LAMBDA_FUNCTION_VERSION });
};
