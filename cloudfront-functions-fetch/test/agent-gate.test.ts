// test/agent-gate.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The CloudFront Function imports the "cloudfront" module, which only exists at the edge.
// For the test we strip the import line and pass in our own cf object.
const source = readFileSync(new URL('../edge/agent-gate.js', import.meta.url), 'utf8')
  .replace(/^import cf from 'cloudfront';$/m, '');

type FakeResponse = { status: number; ok: boolean; json: () => Promise<unknown> };
type FetchFn = (path: string, options: Record<string, unknown>) => Promise<FakeResponse>;

function loadHandler(fetchImpl: FetchFn) {
  const cf = { fetch: fetchImpl };
  return new Function('cf', `${source}\nreturn handler;`)(cf) as (event: unknown) => Promise<any>;
}

const eventWith = (headers: Record<string, { value: string }>) => ({
  request: { uri: '/bikes', headers },
});

const reply = (status: number, body: unknown): FakeResponse => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

test('no token: 401 and no network call', async () => {
  let calls = 0;
  const handler = loadHandler(async () => { calls++; return reply(200, {}); });
  const result = await handler(eventWith({}));
  assert.equal(result.statusCode, 401);
  assert.equal(calls, 0);
});

test('valid token: request continues with agent ID, token is removed', async () => {
  let seen: Record<string, unknown> = {};
  const handler = loadHandler(async (path, options) => {
    seen = { path, ...options };
    return reply(200, { agentId: 'agent-bike-planner', remaining: 41 });
  });
  const result = await handler(eventWith({ 'x-agent-token': { value: 'secret' } }));
  assert.equal(seen.path, '/check');
  assert.equal(seen.originId, 'agent-auth');
  assert.equal(result.headers['x-agent-id'].value, 'agent-bike-planner');
  assert.equal(result.headers['x-agent-token'], undefined);
});

test('budget used up: 429', async () => {
  const handler = loadHandler(async () => reply(429, { reason: 'budget' }));
  const result = await handler(eventWith({ 'x-agent-token': { value: 'secret' } }));
  assert.equal(result.statusCode, 429);
});

test('check service does not answer: fail closed with 503', async () => {
  const handler = loadHandler(async () => {
    const err = new Error('origin did not respond');
    err.name = 'TimeoutError';
    throw err;
  });
  const result = await handler(eventWith({ 'x-agent-token': { value: 'secret' } }));
  assert.equal(result.statusCode, 503);
});
