// src/list-bikes.ts
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { callerOf, readClaims } from './claims';

// Sample data; in a real app this would come from DynamoDB
const BIKES = [
  { id: 'bike-101', model: 'City bike', station: 'Central Station', available: true },
  { id: 'bike-102', model: 'Cargo bike', station: 'Central Station', available: false },
  { id: 'bike-201', model: 'E-Bike', station: 'Market Square', available: true },
];

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const claims = readClaims(event);
  const station = event.queryStringParameters?.station;
  const bikes = station ? BIKES.filter((b) => b.station === station) : BIKES;

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ caller: callerOf(claims), bikes }),
  };
}
