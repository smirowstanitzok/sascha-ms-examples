// src/handler.ts
import type { LambdaFunctionURLEvent } from 'aws-lambda';
import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  type Message,
} from '@aws-sdk/client-bedrock-runtime';
import { runChat } from './chat-loop.js';
import { formatSse, KEEP_ALIVE, type ChatEvent } from './sse.js';
import { runTool, tools } from './tools.js';

const bedrock = new BedrockRuntimeClient({});
const MODEL_ID = process.env.MODEL_ID ?? '';
const MAX_QUESTION = 2000; // characters
const SYSTEM_PROMPT =
  'You are the tour advisor of a bike rental on Lake Constance. ' +
  'Answer in English, friendly and brief (at most 150 words). ' +
  'Use check_availability before you recommend a bike at a station.';
const RETRYABLE = new Set([
  'ThrottlingException',
  'ModelStreamErrorException',
  'InternalServerException',
  'ServiceUnavailableException',
]);

function readQuestion(event: LambdaFunctionURLEvent): string | undefined {
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
      : (event.body ?? '');
    const { question } = JSON.parse(raw) as { question?: unknown };
    if (typeof question !== 'string') return undefined;
    const trimmed = question.trim();
    return trimmed.length > 0 && trimmed.length <= MAX_QUESTION ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

export const handler = awslambda.streamifyResponse(
  async (event: LambdaFunctionURLEvent, responseStream) => {
    const question = readQuestion(event);

    // Before the first byte we can still set a real status code.
    if (!question) {
      const errorStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
      });
      errorStream.end(JSON.stringify({ error: 'Please send a question with 1 to 2000 characters.' }));
      return;
    }

    const stream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });

    let id = 0;
    const send = (e: ChatEvent) => {
      stream.write(formatSse(e, ++id));
    };
    const ping = setInterval(() => stream.write(KEEP_ALIVE), 10_000);

    try {
      const messages: Message[] = [{ role: 'user', content: [{ text: question }] }];
      await runChat({
        messages,
        runTool,
        send,
        converse: async (history) => {
          const res = await bedrock.send(
            new ConverseStreamCommand({
              modelId: MODEL_ID,
              system: [{ text: SYSTEM_PROMPT }],
              messages: history,
              toolConfig: { tools },
              inferenceConfig: { maxTokens: 800 },
            }),
          );
          if (!res.stream) throw new Error('Bedrock did not return a stream');
          return res.stream;
        },
      });
    } catch (err) {
      // The 200 status is already on its way: report the error as an event.
      console.error('Chat aborted', err);
      const name = err instanceof Error ? err.name : 'Error';
      send({
        type: 'error',
        message: 'The answer was interrupted. Please try again in a moment.',
        retryable: RETRYABLE.has(name),
      });
      send({ type: 'done', stopReason: 'error' });
    } finally {
      clearInterval(ping);
      stream.end();
    }
  },
);
