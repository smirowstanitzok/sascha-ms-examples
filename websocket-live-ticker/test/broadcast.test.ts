// test/broadcast.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { broadcast, type Sender } from '../src/broadcast.ts';

function fakeSender(behaviour: Record<string, 'sent' | 'gone' | 'error'>) {
  const delivered: string[] = [];
  const sender: Sender = {
    async send(id, data) {
      const mode = behaviour[id] ?? 'sent';
      if (mode === 'error') throw new Error('Throttled');
      if (mode === 'sent') delivered.push(`${id}:${data}`);
      return mode;
    },
  };
  return { sender, delivered };
}

test('sends the message to all open connections', async () => {
  const { sender, delivered } = fakeSender({});
  const report = await broadcast(['a', 'b', 'c'], { type: 'ticker', text: 'Kick-off' }, sender);
  assert.equal(report.sent, 3);
  assert.equal(delivered.length, 3);
  assert.match(delivered[0], /Kick-off/);
});

test('reports stale and failed connections separately', async () => {
  const { sender } = fakeSender({ b: 'gone', c: 'error' });
  const report = await broadcast(['a', 'b', 'c'], { text: 'Goal' }, sender);
  assert.deepEqual(report, { sent: 1, gone: ['b'], failed: ['c'] });
});

test('respects the maximum concurrency', async () => {
  let running = 0;
  let peak = 0;
  const sender: Sender = {
    async send() {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return 'sent';
    },
  };
  const ids = Array.from({ length: 40 }, (_, i) => `id-${i}`);
  const report = await broadcast(ids, {}, sender, 4);
  assert.equal(report.sent, 40);
  assert.equal(peak, 4);
});

test('handles zero connections', async () => {
  const { sender } = fakeSender({});
  const report = await broadcast([], { text: 'Half-time' }, sender);
  assert.deepEqual(report, { sent: 0, gone: [], failed: [] });
});
