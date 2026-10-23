// src/gateway-client.ts
import Anthropic from '@anthropic-ai/sdk';

// Only needed if a proxy or gateway insists on reading the key from X-Api-Key.
const apiKey = process.env.GATEWAY_API_KEY;
if (!apiKey) throw new Error('GATEWAY_API_KEY is missing');

export const gatewayClient = new Anthropic({
  baseURL: process.env.GATEWAY_BASE_URL,
  apiKey: null,
  authToken: null,
  defaultHeaders: { 'X-Api-Key': apiKey },
});
