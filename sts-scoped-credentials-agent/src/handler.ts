// src/handler.ts
// HTTP API handler: read the shop from the JWT, scope down, start the agent.
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { runAssistant } from './agent.ts';
import { ScopedCredentialBroker } from './credential-broker.ts';
import { assertShopId, shopToolPolicy } from './scope-policy.ts';
import { createShopTools } from './tools.ts';

const BUCKET = process.env.DOCS_BUCKET ?? '';
const MODEL_ID = process.env.MODEL_ID ?? '';
// Outside the handler: the cache survives warm invocations.
const broker = new ScopedCredentialBroker();

const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  const shopId = String(event.requestContext.authorizer.jwt.claims['custom:shop_id'] ?? '');
  try {
    assertShopId(shopId);
  } catch {
    return json(403, { message: 'No valid rental shop in token' });
  }

  let question = '';
  try {
    const body = JSON.parse(event.body ?? '{}') as { question?: unknown };
    question = typeof body.question === 'string' ? body.question.slice(0, 2000) : '';
  } catch {
    return json(400, { message: 'Body must be JSON' });
  }
  if (!question) return json(400, { message: 'Field "question" is missing' });

  // 15 minutes, own shop prefix only, purpose ends up in CloudTrail.
  const credentials = await broker.scope({
    policy: shopToolPolicy(BUCKET, shopId),
    durationSeconds: 900,
    description: `rental-assistant shop=${shopId}`,
  });

  const tools = createShopTools(BUCKET, shopId, credentials);
  const answer = await runAssistant(question, tools, MODEL_ID);
  return json(200, { answer });
};
