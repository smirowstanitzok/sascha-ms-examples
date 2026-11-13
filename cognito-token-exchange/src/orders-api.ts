// src/orders-api.ts
// Orders API: API Gateway checks signature, aud and scope; the Lambda also checks the act claim
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { decodeJwtPayload } from './token-client.js';
import { entscheide } from './policy.js';

const BEISPIEL = [
  { id: 'B-1001', titel: 'The Hobbit', status: 'shipped' },
  { id: 'B-1002', titel: 'Cooking for Geeks', status: 'processing' },
];

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> => {
  const token = (event.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const claims = decodeJwtPayload(token); // the JWT authorizer has already checked the signature
  const aktion = event.requestContext.http.method === 'DELETE' ? 'stornieren' : 'lesen';
  const e = entscheide(claims, aktion);

  // Audit log: who acted, and was an agent involved?
  console.log(JSON.stringify({ nutzer: claims.sub, akteur: e.akteur ?? null, aktion, erlaubt: e.erlaubt }));

  if (!e.erlaubt) return { statusCode: 403, body: JSON.stringify({ fehler: e.grund }) };
  if (aktion === 'stornieren') return { statusCode: 204 };
  return { statusCode: 200, body: JSON.stringify(BEISPIEL) };
};
