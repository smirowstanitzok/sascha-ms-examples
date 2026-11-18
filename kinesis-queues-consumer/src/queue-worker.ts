// src/queue-worker.ts
import {
  AcknowledgeQueueRecordsCommand,
  KinesisClient,
  ReceiveQueueRecordsCommand,
  UpdateQueueRecordsVisibilityCommand,
  type QueueRecord,
} from '@aws-sdk/client-kinesis';

export type RecordHandler = (record: QueueRecord) => Promise<void>;

export interface WorkerOptions {
  queueArn: string;
  handler: RecordHandler;
  /** Long polling: 1 to 20 seconds. */
  waitTimeSeconds?: number;
  /** First retry delay in seconds; doubles with every further delivery. */
  retryBaseSeconds?: number;
  /** Upper bound for the retry delay in seconds. */
  maxRetryDelaySeconds?: number;
  log?: (message: string, details?: Record<string, unknown>) => void;
}

export interface BatchResult {
  received: number;
  acknowledged: number;
  retried: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class QueueWorker {
  private running = false;

  constructor(
    private readonly client: KinesisClient,
    private readonly options: WorkerOptions,
  ) {}

  /** Delay before the next attempt: 5 s, 10 s, 20 s ... capped at the maximum. */
  retryDelaySeconds(receiveCount: number): number {
    const base = this.options.retryBaseSeconds ?? 5;
    const max = this.options.maxRetryDelaySeconds ?? 300;
    return Math.min(base * 2 ** Math.max(receiveCount - 1, 0), max);
  }

  /** Receives up to 10 records, processes them in parallel and acknowledges the successful ones. */
  async processBatch(): Promise<BatchResult> {
    const { QueueRecords: records = [] } = await this.client.send(
      new ReceiveQueueRecordsCommand({
        QueueARN: this.options.queueArn,
        Limit: 10,
        WaitTimeSeconds: this.options.waitTimeSeconds ?? 20,
      }),
    );
    if (records.length === 0) return { received: 0, acknowledged: 0, retried: 0 };

    const outcomes = await Promise.allSettled(records.map((record) => this.options.handler(record)));

    const succeeded: QueueRecord[] = [];
    const failed: QueueRecord[] = [];
    outcomes.forEach((outcome, i) => {
      if (outcome.status === 'fulfilled') {
        succeeded.push(records[i]);
      } else {
        failed.push(records[i]);
        this.log('record failed', {
          recordId: records[i].RecordId,
          receiveCount: records[i].ReceiveCount,
          error: String(outcome.reason),
        });
      }
    });

    const acknowledged = await this.acknowledge(succeeded);
    await this.scheduleRetry(failed);
    return { received: records.length, acknowledged, retried: failed.length };
  }

  /** Long-running loop until stop() is called. */
  async run(): Promise<void> {
    this.running = true;
    while (this.running) {
      try {
        await this.processBatch();
      } catch (error) {
        this.log('receive failed, pausing briefly', { error: String(error) });
        await sleep(1000);
      }
    }
  }

  /** The current long poll still finishes (at most waitTimeSeconds). */
  stop(): void {
    this.running = false;
  }

  private async acknowledge(records: QueueRecord[]): Promise<number> {
    let pending = records.map((r) => r.ReceiptHandle!).filter(Boolean);
    let acknowledged = 0;
    for (let attempt = 1; attempt <= 2 && pending.length > 0; attempt++) {
      const result = await this.client.send(
        new AcknowledgeQueueRecordsCommand({
          QueueARN: this.options.queueArn,
          Entries: pending.map((handle) => ({ ReceiptHandle: handle })),
        }),
      );
      acknowledged += result.Successful?.length ?? 0;
      // HTTP 200 does not mean every entry worked: check Failed every time.
      pending = (result.Failed ?? []).map((f) => f.ReceiptHandle!).filter(Boolean);
    }
    if (pending.length > 0) {
      // Not dramatic: the record comes back and the idempotent handler skips it.
      this.log('acknowledge failed, record will be redelivered', { count: pending.length });
    }
    return acknowledged;
  }

  private async scheduleRetry(records: QueueRecord[]): Promise<void> {
    if (records.length === 0) return;
    const result = await this.client.send(
      new UpdateQueueRecordsVisibilityCommand({
        QueueARN: this.options.queueArn,
        Entries: records.map((r) => ({
          ReceiptHandle: r.ReceiptHandle!,
          VisibilityTimeoutSeconds: this.retryDelaySeconds(r.ReceiveCount ?? 1),
        })),
      }),
    );
    if ((result.Failed ?? []).length > 0) {
      this.log('could not change visibility, queue default applies', { count: result.Failed!.length });
    }
  }

  private log(message: string, details?: Record<string, unknown>): void {
    (this.options.log ?? ((m, d) => console.log(JSON.stringify({ message: m, ...d }))))(message, details);
  }
}
