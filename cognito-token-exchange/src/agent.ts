// src/agent.ts
// Agent Lambda: accepts the user token, exchanges it and calls the orders API on the user's behalf
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { CognitoIdentityProviderClient, DescribeUserPoolClientCommand } from '@aws-sdk/client-cognito-identity-provider';
import { buildClientCredentialsBody, buildExchangeBody, requestToken, type ClientConfig } from './token-client.js';

const cognito = new CognitoIdentityProviderClient({});
const { USER_POOL_ID, AGENT_CLIENT_ID, TOKEN_URL, ORDERS_API_URL } = process.env as Record<string, string>;

let config: ClientConfig | undefined;
let actor: { token: string; validUntil: number } | undefined;

// Fetch the client secret once per cold start instead of storing it in environment variables
async function getConfig(): Promise<ClientConfig> {
  if (config) return config;
  const out = await cognito.send(new DescribeUserPoolClientCommand({ UserPoolId: USER_POOL_ID, ClientId: AGENT_CLIENT_ID }));
  config = { tokenUrl: TOKEN_URL, clientId: AGENT_CLIENT_ID, clientSecret: out.UserPoolClient!.ClientSecret! };
  return config;
}

// The agent's actor token (client credentials), cached until shortly before it expires
async function getActorToken(cfg: ClientConfig): Promise<string> {
  if (actor && actor.validUntil > Date.now()) return actor.token;
  const res = await requestToken(cfg, buildClientCredentialsBody(['buchladen-agent/handeln']));
  actor = { token: res.access_token, validUntil: Date.now() + (res.expires_in - 60) * 1000 };
  return actor.token;
}

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> => {
  const userToken = (event.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const cfg = await getConfig();

  // Delegation: user token + actor token -> new token only for the orders API, read only
  const exchanged = await requestToken(
    cfg,
    buildExchangeBody({
      subjectToken: userToken,
      actorToken: await getActorToken(cfg),
      audience: 'bestellungen',
      scopes: ['bestellungen/lesen'],
    }),
  );

  const res = await fetch(`${ORDERS_API_URL}/bestellungen`, {
    headers: { Authorization: `Bearer ${exchanged.access_token}` },
  });
  const bestellungen = await res.json();

  // A real agent would pass the data to the language model here
  return { statusCode: 200, body: JSON.stringify({ antwort: 'Your latest orders', bestellungen }) };
};
