// src/start-rental.ts
import { randomUUID } from 'node:crypto';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const body = JSON.parse(event.body ?? '{}') as { bikeId?: string };
  if (!body.bikeId) {
    return { statusCode: 400, body: JSON.stringify({ message: 'bikeId is missing' }) };
  }
  // Writing to DynamoDB and SQS is left out on purpose –
  // this example is about testing the infrastructure.
  const rentalId = randomUUID();
  return { statusCode: 201, body: JSON.stringify({ rentalId, bikeId: body.bikeId }) };
};
