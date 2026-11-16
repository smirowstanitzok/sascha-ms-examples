// test/sse-client.test.ts
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { formatSse, KEEP_ALIVE } from '../src/sse.js';
import { askAdvisor, readSse } from '../web/sse-client.js';

// Builds a stream that delivers the text in arbitrarily small chunks.
function chunked(text: string, size: number): ReadableStream<string> {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return new ReadableStream({
    pull(controller) {
      const next = parts.shift();
      if (next === undefined) controller.close();
      else controller.enqueue(next);
    },
  });
}

async function collect(stream: ReadableStream<string>) {
  const out = [];
  for await (const msg of readSse(stream)) out.push(msg);
  return out;
}

describe('readSse', () => {
  const raw =
    KEEP_ALIVE +
    formatSse({ type: 'text', text: 'Hello\nworld' }, 1) +
    'event: note\r\ndata: Line 1\r\ndata: Line 2\r\n\r\n' +
    formatSse({ type: 'done', stopReason: 'end_turn' }, 2);

  it('reads events regardless of chunk size', async () => {
    for (const size of [1, 3, 7, 1000]) {
      const msgs = await collect(chunked(raw, size));
      expect(msgs.map((m) => m.event)).toEqual(['text', 'note', 'done']);
      expect(JSON.parse(msgs[0]!.data)).toEqual({ text: 'Hello\nworld' });
      expect(msgs[1]!.data).toBe('Line 1\nLine 2');
      expect(msgs[2]!.id).toBe('2');
    }
  });

  it('ignores keep-alive comments', async () => {
    expect(await collect(chunked(KEEP_ALIVE + KEEP_ALIVE, 4))).toEqual([]);
  });
});

describe('askAdvisor', () => {
  it('dispatches events from a real HTTP stream', async () => {
    const server = createServer((req, res) => {
      expect(req.headers['x-amz-content-sha256']).toMatch(/^[0-9a-f]{64}$/);
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
      res.write(formatSse({ type: 'tool', name: 'check_availability', status: 'start' }, 1));
      res.write(formatSse({ type: 'text', text: 'Lindau has ' }, 2).slice(0, 10));
      setTimeout(() => {
        res.write(formatSse({ type: 'text', text: 'Lindau has ' }, 2).slice(10));
        res.write(formatSse({ type: 'text', text: '3 e-bikes available.' }, 3));
        res.write(formatSse({ type: 'usage', inputTokens: 120, outputTokens: 30 }, 4));
        res.end(formatSse({ type: 'done', stopReason: 'end_turn' }, 5));
      }, 20);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;

    let text = '';
    const tools: string[] = [];
    let usage = 0;
    const stop = await askAdvisor(`http://127.0.0.1:${port}/`, 'E-bike in Lindau?', {
      onText: (t) => (text += t),
      onTool: (name, status) => tools.push(`${name}:${status}`),
      onUsage: (i, o) => (usage = i + o),
    });
    server.close();

    expect(stop).toBe('end_turn');
    expect(text).toBe('Lindau has 3 e-bikes available.');
    expect(tools).toEqual(['check_availability:start']);
    expect(usage).toBe(150);
  });
});
