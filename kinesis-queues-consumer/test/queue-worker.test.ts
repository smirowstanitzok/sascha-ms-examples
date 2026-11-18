// test/queue-worker.test.ts
import {
  AcknowledgeQueueRecordsCommand,
  KinesisClient,
  ReceiveQueueRecordsCommand,
  UpdateQueueRecordsVisibilityCommand,
} from '@aws-sdk/client-kinesis';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ClaimResult, IdempotencyStore } from '../src/idempotency.js';
import { QueueWorker } from '../src/queue-worker.js';
import { createTicketMailer, parseTicketSold } from '../src/ticket-mailer.js';

const QUEUE_ARN = 'arn:aws:kinesis:eu-central-1:111122223333:queue/example';
const kinesis = mockClient(KinesisClient);

const ticketRecord = (orderId: string, receiveCount = 1) => ({
  ReceiptHandle: `handle-${orderId}-${receiveCount}`,
  RecordId: `record-${orderId}`,
  PartitionKey: orderId,
  Data: new TextEncoder().encode(
    JSON.stringify({ orderId, eventName: 'Jazz in the park', email: 'fan@example.com', seats: 2 }),
  ),
  ApproximateArrivalTimestamp: new Date(),
  FirstReceiveTimestamp: new Date(),
  ReceiveCount: receiveCount,
});

class MemoryStore implements IdempotencyStore {
  state = new Map<string, 'PENDING' | 'DONE'>();
  async claim(key: string): Promise<ClaimResult> {
    const current = this.state.get(key);
    if (current === 'DONE') return 'done';
    if (current === 'PENDING') return 'busy';
    this.state.set(key, 'PENDING');
    return 'claimed';
  }
  async complete(key: string) {
    this.state.set(key, 'DONE');
  }
  async release(key: string) {
    this.state.delete(key);
  }
}

describe('QueueWorker', () => {
  beforeEach(() => kinesis.reset());

  it('acknowledges successful records and delays failed ones', async () => {
    kinesis.on(ReceiveQueueRecordsCommand).resolves({ QueueRecords: [ticketRecord('A-1'), ticketRecord('A-2', 3)] });
    kinesis.on(AcknowledgeQueueRecordsCommand).resolves({ Successful: [{ ReceiptHandle: 'handle-A-1-1' }], Failed: [] });
    kinesis.on(UpdateQueueRecordsVisibilityCommand).resolves({ Successful: [], Failed: [] });

    const worker = new QueueWorker(new KinesisClient({}), {
      queueArn: QUEUE_ARN,
      handler: async (r) => {
        if (r.RecordId === 'record-A-2') throw new Error('mail service down');
      },
      log: () => undefined,
    });

    const result = await worker.processBatch();

    expect(result).toEqual({ received: 2, acknowledged: 1, retried: 1 });
    const ack = kinesis.commandCalls(AcknowledgeQueueRecordsCommand)[0].args[0].input;
    expect(ack.Entries).toEqual([{ ReceiptHandle: 'handle-A-1-1' }]);
    const visibility = kinesis.commandCalls(UpdateQueueRecordsVisibilityCommand)[0].args[0].input;
    // third delivery: 5 s * 2^2 = 20 s
    expect(visibility.Entries).toEqual([{ ReceiptHandle: 'handle-A-2-3', VisibilityTimeoutSeconds: 20 }]);
  });

  it('retries entries reported in Failed despite HTTP 200', async () => {
    kinesis.on(ReceiveQueueRecordsCommand).resolves({ QueueRecords: [ticketRecord('B-1')] });
    kinesis
      .on(AcknowledgeQueueRecordsCommand)
      .resolvesOnce({ Successful: [], Failed: [{ ReceiptHandle: 'handle-B-1-1', ErrorCode: 'InternalFailure' }] })
      .resolvesOnce({ Successful: [{ ReceiptHandle: 'handle-B-1-1' }], Failed: [] });

    const worker = new QueueWorker(new KinesisClient({}), { queueArn: QUEUE_ARN, handler: async () => undefined });
    const result = await worker.processBatch();

    expect(result.acknowledged).toBe(1);
    expect(kinesis.commandCalls(AcknowledgeQueueRecordsCommand)).toHaveLength(2);
  });

  it('caps the retry delay', () => {
    const worker = new QueueWorker(new KinesisClient({}), {
      queueArn: QUEUE_ARN,
      handler: async () => undefined,
      maxRetryDelaySeconds: 60,
    });
    expect([1, 2, 3, 4, 5].map((n) => worker.retryDelaySeconds(n))).toEqual([5, 10, 20, 40, 60]);
  });

  it('does nothing on an empty receive', async () => {
    kinesis.on(ReceiveQueueRecordsCommand).resolves({ QueueRecords: [] });
    const worker = new QueueWorker(new KinesisClient({}), { queueArn: QUEUE_ARN, handler: async () => undefined });
    expect(await worker.processBatch()).toEqual({ received: 0, acknowledged: 0, retried: 0 });
    expect(kinesis.commandCalls(AcknowledgeQueueRecordsCommand)).toHaveLength(0);
  });
});

describe('ticket mailer', () => {
  it('sends the mail only once when the queue delivers twice', async () => {
    const sent: string[] = [];
    const handler = createTicketMailer(new MemoryStore(), async (t) => {
      sent.push(t.orderId);
    });

    await handler(ticketRecord('C-7'));
    await handler(ticketRecord('C-7', 2)); // redelivery

    expect(sent).toEqual(['C-7']);
  });

  it('releases the claim when sending fails so the next attempt can retry', async () => {
    const store = new MemoryStore();
    let fail = true;
    const handler = createTicketMailer(store, async () => {
      if (fail) throw new Error('SMTP timeout');
    });

    await expect(handler(ticketRecord('D-2'))).rejects.toThrow('SMTP timeout');
    fail = false;
    await handler(ticketRecord('D-2', 2));

    expect(store.state.get('ticket-mail#D-2')).toBe('DONE');
  });

  it('rejects incomplete events', () => {
    expect(() => parseTicketSold(new TextEncoder().encode('{"orderId":"X"}'))).toThrow(/incomplete/);
  });
});
