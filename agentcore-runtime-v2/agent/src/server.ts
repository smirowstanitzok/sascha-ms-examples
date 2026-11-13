// agent/src/server.ts
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { freshId } from './entropy.js';

// ---------- Startup: runs once, before the snapshot ----------
// Only values that stay the same for the whole agent version belong here.
type FaqEntry = { q: string; a: string };
const faq: FaqEntry[] = JSON.parse(
  readFileSync(new URL('../../data/faq.json', import.meta.url), 'utf8'),
);

const systemPrompt = [
  'You are the support assistant of the fictional bike rental "Spokeworks".',
  'Answer briefly and only based on these facts:',
  ...faq.map((e) => `- ${e.q} ${e.a}`),
].join('\n');

const modelId = process.env.MODEL_ID;
if (!modelId) throw new Error('MODEL_ID is not set');

// Build the client at startup; the SDK refreshes credentials when they expire.
const bedrock = new BedrockRuntimeClient({});

let ready = false;

// ---------- Request handling: runs on every request ----------
async function answer(question: string, sessionId: string) {
  const requestId = freshId(); // unique per request, also after a restore
  const startedAt = Date.now(); // reference time taken in the handler

  const result = await bedrock.send(
    new ConverseCommand({
      modelId,
      system: [{ text: systemPrompt }],
      messages: [{ role: 'user', content: [{ text: question }] }],
      inferenceConfig: { maxTokens: 400 },
    }),
  );

  const text = result.output?.message?.content?.map((c) => c.text ?? '').join('') ?? '';
  console.log(JSON.stringify({ requestId, sessionId, durationMs: Date.now() - startedAt }));
  return { requestId, answer: text, answeredAt: new Date().toISOString() };
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/ping') {
      // Report healthy only after initialization: the snapshot is taken then.
      return ready ? send(res, 200, { status: 'Healthy' }) : send(res, 503, { status: 'Unhealthy' });
    }
    if (req.method === 'POST' && req.url === '/invocations') {
      const payload = JSON.parse((await readBody(req)) || '{}') as { prompt?: string };
      if (!payload.prompt) return send(res, 400, { error: 'prompt is missing' });
      const sessionId = String(req.headers['x-amzn-bedrock-agentcore-runtime-session-id'] ?? 'local');
      return send(res, 200, await answer(payload.prompt, sessionId));
    }
    send(res, 404, { error: 'not found' });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: 'internal error' });
  }
});

server.listen(8080, '0.0.0.0', () => {
  ready = true;
  console.log('Agent listening on port 8080');
});
