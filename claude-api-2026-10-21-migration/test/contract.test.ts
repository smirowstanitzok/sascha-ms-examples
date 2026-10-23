// test/contract.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';

type Captured = { headers: Headers; body: Record<string, unknown> };

function fakeFetch(captured: Captured[]): typeof fetch {
  return async (_url, init) => {
    captured.push({
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    });
    const reply = {
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-5-5',
      content: [{ type: 'text', text: 'ok' }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    };
    return new Response(JSON.stringify(reply), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
}

test('Requests match API version 2026-10-21', async () => {
  const captured: Captured[] = [];
  const client = new Anthropic({ apiKey: 'test-key', fetch: fakeFetch(captured) });

  await client.messages.create({
    model: 'claude-sonnet-5-5',
    max_tokens: 64,
    messages: [{ role: 'user', content: 'Hello' }],
  });

  const [request] = captured;
  assert.equal(request.headers.get('anthropic-version'), '2026-10-21');
  assert.equal(request.headers.get('authorization'), 'Bearer test-key');
  for (const param of ['temperature', 'top_p', 'top_k']) {
    assert.ok(!(param in request.body), `${param} must not be sent`);
  }
});
