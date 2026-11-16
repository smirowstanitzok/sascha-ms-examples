// test/partner-worker.test.ts
import { describe, expect, it } from 'vitest';
import type { SQSEvent } from 'aws-lambda';
import { createPartnerWorker } from '../src/partner-worker.ts';

const event = (ids: string[]): SQSEvent =>
  ({
    Records: ids.map((id) => ({
      messageId: id,
      body: JSON.stringify({ bookingId: `b-${id}`, partner: 'sms', payload: {} }),
    })),
  }) as unknown as SQSEvent;

const plenty = { getRemainingTimeInMillis: () => 60_000 };

describe('createPartnerWorker', () => {
  it('reports only failed messages', async () => {
    const worker = createPartnerWorker(
      async (task) => {
        if (task.bookingId === 'b-2') throw new Error('partner answered with 503');
      },
      { callTimeoutMs: 100 },
    );
    const res = await worker(event(['1', '2', '3']), plenty);
    expect(res.batchItemFailures).toEqual([{ itemIdentifier: '2' }]);
  });

  it('cuts off a hanging partner with the timeout', async () => {
    const worker = createPartnerWorker(
      (_task, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason));
        }),
      { callTimeoutMs: 50 },
    );
    const started = Date.now();
    const res = await worker(event(['1']), plenty);
    expect(res.batchItemFailures).toHaveLength(1);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('returns the rest of the batch when time runs out', async () => {
    let remaining = 4000;
    const worker = createPartnerWorker(
      async () => {
        remaining -= 2000;
      },
      { callTimeoutMs: 2000, safetyMarginMs: 500 },
    );
    const res = await worker(event(['1', '2', '3']), { getRemainingTimeInMillis: () => remaining });
    expect(res.batchItemFailures).toEqual([{ itemIdentifier: '2' }, { itemIdentifier: '3' }]);
  });
});
