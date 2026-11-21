// src/handler.ts
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createGuard } from './guard.ts';

const client = new BedrockRuntimeClient({});
const guard = createGuard(
  (command) => client.send(command),
  process.env.GUARDRAIL_ID!,
  process.env.GUARDRAIL_VERSION!,
);
const MODEL_ID = process.env.MODEL_ID!;
const MAX_LENGTH = 2000;

const SYSTEM_PROMPT =
  'You are the support assistant of the bike rental shop "Speichenwerk". ' +
  'You answer questions about rentals, prices, returns and breakdown help. ' +
  'Answer briefly and in a friendly tone.';

const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  let message: unknown;
  try {
    message = JSON.parse(event.body ?? '{}').message;
  } catch {
    return json(400, { error: 'Body must be valid JSON.' });
  }
  if (typeof message !== 'string' || message.trim() === '' || message.length > MAX_LENGTH) {
    return json(400, { error: `Field "message" is missing or longer than ${MAX_LENGTH} characters.` });
  }

  // 1. Check the input: prompt attacks, denied topics, personal data
  const input = await guard(message, 'INPUT');
  console.log(JSON.stringify({ step: 'input', allowed: input.allowed, findings: input.findings }));
  if (!input.allowed) return json(200, { reply: input.text, blocked: true });

  // 2. Call the model with the (possibly masked) text, never with the original
  const res = await client.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [{ role: 'user', content: [{ text: input.text }] }],
      inferenceConfig: { maxTokens: 500 },
    }),
  );
  const answer = (res.output?.message?.content ?? []).map((c) => c.text ?? '').join('');

  // 3. Check the answer before it reaches the browser
  const output = await guard(answer, 'OUTPUT');
  console.log(JSON.stringify({ step: 'output', allowed: output.allowed, findings: output.findings }));
  return json(200, { reply: output.text, blocked: !output.allowed });
};
