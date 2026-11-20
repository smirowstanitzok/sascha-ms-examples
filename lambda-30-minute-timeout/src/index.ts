// src/index.ts
import { setTimeout as sleep } from 'node:timers/promises';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { DynamoCheckpointStore } from './dynamo-checkpoint-store.ts';
import { createHandler } from './render-photobook.ts';

const sqs = new SQSClient({});
const queueUrl = requiredEnv('RENDER_QUEUE_URL');
const pageRenderMs = Number(process.env.PAGE_RENDER_MS ?? '2000');

export const handler = createHandler({
  store: new DynamoCheckpointStore(requiredEnv('CHECKPOINT_TABLE')),
  // Placeholder: this is where a page would be rendered as a print PDF
  renderPage: async () => {
    await sleep(pageRenderMs);
  },
  requeue: async (order) => {
    await sqs.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(order) }));
  },
  safetyMarginMs: 90_000,
  checkpointEvery: 10,
  maxContinuations: 20,
});

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is missing`);
  return value;
}
