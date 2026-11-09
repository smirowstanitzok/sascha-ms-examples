// src/handler.ts
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { loadConfig } from './config.js';
import { quotePrice } from './pricing.js';

export const quote: APIGatewayProxyHandlerV2 = async (event) => {
  // Cached for up to 300 seconds per execution environment
  const config = await loadConfig();
  const hours = Number(event.queryStringParameters?.hours ?? '1');
  const result = quotePrice(hours, config);

  if (!result.ok) {
    return { statusCode: 400, body: JSON.stringify({ message: result.reason }) };
  }
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      hours: result.hours,
      totalCents: result.totalCents,
      // Never return the key itself, only whether it is there
      paymentReady: config.paymentApiKey.length > 0,
    }),
  };
};
