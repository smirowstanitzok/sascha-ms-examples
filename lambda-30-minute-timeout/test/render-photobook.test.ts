// test/render-photobook.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryCheckpointStore } from '../src/checkpoint-store.ts';
import { renderOrder, createHandler, type PhotoBookOrder, type RenderDeps } from '../src/render-photobook.ts';

// Fake clock: every rendered page "costs" one minute
function fakeBudget(totalMinutes: number) {
  let usedMs = 0;
  return {
    budget: { getRemainingTimeInMillis: () => totalMinutes * 60_000 - usedMs },
    tick: () => { usedMs += 60_000; },
  };
}

function deps(store: MemoryCheckpointStore, tick: () => void, requeued: PhotoBookOrder[]): RenderDeps {
  return {
    store,
    renderPage: async () => tick(),
    requeue: async (order) => { requeued.push(order); },
    safetyMarginMs: 90_000,
    checkpointEvery: 5,
    maxContinuations: 3,
  };
}

describe('renderOrder', () => {
  it('renders a small order in one go', async () => {
    const store = new MemoryCheckpointStore();
    const { budget, tick } = fakeBudget(30);
    const requeued: PhotoBookOrder[] = [];
    const result = await renderOrder({ orderId: 'b-1', pageCount: 20 }, deps(store, tick, requeued), budget);
    assert.equal(result, 'done');
    assert.equal(requeued.length, 0);
    assert.deepEqual(await store.load('b-1'), { nextPage: 21, done: true });
  });

  it('pauses before the timeout and continues from the checkpoint', async () => {
    const store = new MemoryCheckpointStore();
    const requeued: PhotoBookOrder[] = [];

    const first = fakeBudget(30);
    const r1 = await renderOrder({ orderId: 'b-2', pageCount: 40 }, deps(store, first.tick, requeued), first.budget);
    assert.equal(r1, 'paused');
    assert.equal(requeued[0]?.continuation, 1);
    const { nextPage } = await store.load('b-2');
    assert.ok(nextPage > 25 && nextPage < 31, `unexpected checkpoint ${nextPage}`);

    const second = fakeBudget(30);
    const r2 = await renderOrder(requeued[0] as PhotoBookOrder, deps(store, second.tick, requeued), second.budget);
    assert.equal(r2, 'done');
  });

  it('skips orders that are already done', async () => {
    const store = new MemoryCheckpointStore();
    await store.finish('b-3');
    const { budget, tick } = fakeBudget(30);
    const result = await renderOrder({ orderId: 'b-3', pageCount: 5 }, deps(store, tick, []), budget);
    assert.equal(result, 'skipped');
  });

  it('gives up after too many continuations', async () => {
    const store = new MemoryCheckpointStore();
    const { budget, tick } = fakeBudget(1);
    await assert.rejects(
      renderOrder({ orderId: 'b-4', pageCount: 5, continuation: 3 }, deps(store, tick, []), budget),
      /too many continuations/,
    );
  });
});

describe('handler', () => {
  it('reports invalid messages as batch item failures', async () => {
    const store = new MemoryCheckpointStore();
    const { budget, tick } = fakeBudget(30);
    const handler = createHandler(deps(store, tick, []));
    const event = { Records: [{ messageId: 'm-1', body: '{"orderId":"b-5"}' }] } as never;
    const response = await handler(event, budget);
    assert.deepEqual(response.batchItemFailures, [{ itemIdentifier: 'm-1' }]);
  });
});
