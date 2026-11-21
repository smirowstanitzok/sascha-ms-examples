// src/bike-api.ts
import type { LambdaFunctionURLEvent, LambdaFunctionURLResult } from 'aws-lambda';

const bikes = [
  { id: 'b-101', model: 'City bike 3-speed', station: 'Central Station', available: true },
  { id: 'b-102', model: 'E-cargo bike', station: 'Market Square', available: false },
  { id: 'b-103', model: 'Trekking bike', station: 'Harbour', available: true },
];

export async function handler(event: LambdaFunctionURLEvent): Promise<LambdaFunctionURLResult> {
  // The CloudFront Function sets this header after a successful check
  const agentId = event.headers['x-agent-id'] ?? 'unknown';
  const path = event.rawPath;

  if (path === '/bikes') {
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestedBy: agentId, bikes }),
    };
  }
  return { statusCode: 404, body: JSON.stringify({ message: 'Not found' }) };
}
