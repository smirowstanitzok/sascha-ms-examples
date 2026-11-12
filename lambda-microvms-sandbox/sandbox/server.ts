// sandbox/server.ts
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { executeSnippet } from './execute.ts';

const PORT = Number(process.env.PORT ?? 8080);
const HOOKS = '/aws/lambda-microvms/runtime/v1';
const MAX_BODY_BYTES = 64 * 1024;
const MAX_RUNS_PER_SESSION = 200;

// State per MicroVM. It is captured in the snapshot and therefore
// reset in the /run hook for every new MicroVM.
let sessionLabel = 'unknown';
let runCount = 0;

async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error('Request body too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  try {
    // Build hook: snapshot may be taken as soon as we answer 200
    if (req.method === 'POST' && req.url === `${HOOKS}/ready`) {
      return send(res, 200, { ready: true });
    }
    // Runtime hook: called once per new MicroVM, before any traffic
    if (req.method === 'POST' && req.url === `${HOOKS}/run`) {
      const { microvmId, runHookPayload } = JSON.parse((await readBody(req)) || '{}');
      sessionLabel = String(runHookPayload ?? microvmId ?? 'unknown');
      runCount = 0;
      console.log(`Sandbox started for session ${sessionLabel}`);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'GET' && req.url === '/health') {
      return send(res, 200, { status: 'ok', session: sessionLabel, runs: runCount });
    }
    if (req.method === 'POST' && req.url === '/snippets') {
      if (runCount >= MAX_RUNS_PER_SESSION) {
        return send(res, 429, { error: 'Run limit for this session reached' });
      }
      const { code } = JSON.parse(await readBody(req));
      if (typeof code !== 'string' || code.length === 0) {
        return send(res, 400, { error: 'Field "code" is missing' });
      }
      runCount += 1;
      const result = await executeSnippet(code, { timeoutMs: 5_000 });
      return send(res, 200, { run: runCount, ...result });
    }
    return send(res, 404, { error: 'Not found' });
  } catch (err) {
    return send(res, 400, { error: (err as Error).message });
  }
});

server.listen(PORT, () => console.log(`Sandbox runner listening on port ${PORT}`));
