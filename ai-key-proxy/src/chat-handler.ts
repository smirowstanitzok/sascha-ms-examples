// src/chat-handler.ts
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { checkRequest, MAX_ANSWER_TOKENS, estimateTokens } from './request.js';
import { adjust, reserve } from './quota.js';

// No API key: the client signs with the temporary credentials of the Lambda role.
const bedrock = new BedrockRuntimeClient({});

const MODEL = process.env.MODEL_ID!;
const TABLE = process.env.QUOTA_TABLE!;
const DAILY_LIMIT = Number(process.env.DAILY_TOKEN_LIMIT ?? '20000');

const SYSTEM_PROMPT =
  'You are the book advisor of the bookshop "Bookworm". Recommend books and only answer questions about them. Keep your answers short.';

function respond(status: number, body: unknown): APIGatewayProxyResultV2 {
  return { statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  // The user ID comes from the validated token, not from the body
  const userId = event.requestContext.authorizer.jwt.claims.sub as string;

  const check = checkRequest(event.body);
  if (!check.ok) return respond(400, { error: check.reason });

  const reserved = estimateTokens(check.question);
  if (!(await reserve(TABLE, userId, reserved, DAILY_LIMIT))) {
    return respond(429, { error: 'Daily quota used up, see you tomorrow.' });
  }

  try {
    const result = await bedrock.send(
      new ConverseCommand({
        modelId: MODEL,
        system: [{ text: SYSTEM_PROMPT }],
        messages: [{ role: 'user', content: [{ text: check.question }] }],
        inferenceConfig: { maxTokens: MAX_ANSWER_TOKENS },
      }),
    );
    const used = result.usage?.totalTokens ?? reserved;
    await adjust(TABLE, userId, used - reserved);

    // Metric in Embedded Metric Format: CloudWatch reads it straight from the log
    console.log(
      JSON.stringify({
        _aws: {
          Timestamp: Date.now(),
          CloudWatchMetrics: [{ Namespace: 'BookAdvisor', Dimensions: [[]], Metrics: [{ Name: 'TokensUsed', Unit: 'Count' }] }],
        },
        TokensUsed: used,
      }),
    );

    const text = result.output?.message?.content?.find((part) => part.text)?.text ?? '';
    return respond(200, { answer: text, tokens: used });
  } catch (error) {
    // Release the reservation so that an error does not eat up the quota
    await adjust(TABLE, userId, -reserved);
    console.error('Model call failed', (error as Error).name);
    return respond(502, { error: 'The book advisor is not available right now.' });
  }
}
