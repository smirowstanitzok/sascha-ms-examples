// src/availability.ts
import type { APIGatewayProxyResultV2 } from 'aws-lambda';

// Fictional example: a bike rental reports how many bikes are free at each station.
const stations = [
  { id: 'harbour', name: 'At the harbour', freeBikes: 7 },
  { id: 'station', name: 'Central station', freeBikes: 2 },
];

export const handler = async (): Promise<APIGatewayProxyResultV2> => {
  // Structured logging: with the JSON log format, Lambda filters DEBUG lines itself.
  console.debug(JSON.stringify({ msg: 'Stations loaded', count: stations.length }));
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(stations),
  };
};
