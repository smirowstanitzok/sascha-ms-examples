// src/partner-worker.ts
// Generic SQS worker: one instance per partner. Processes the batch one by one,
// so the number of parallel partner calls equals the number of running invocations.
import type { Context, SQSBatchResponse, SQSEvent } from 'aws-lambda';

export interface PartnerTask {
  bookingId: string;
  partner: string;
  payload: Record<string, unknown>;
}

export type PartnerCall = (task: PartnerTask, signal: AbortSignal) => Promise<void>;

export interface WorkerOptions {
  /** Maximum time for a single partner call. */
  callTimeoutMs: number;
  /** Time we keep in reserve before the Lambda timeout. */
  safetyMarginMs?: number;
}

export function createPartnerWorker(call: PartnerCall, options: WorkerOptions) {
  const margin = options.safetyMarginMs ?? 1000;

  return async (event: SQSEvent, context: Pick<Context, 'getRemainingTimeInMillis'>): Promise<SQSBatchResponse> => {
    const failures: SQSBatchResponse['batchItemFailures'] = [];

    for (const record of event.Records) {
      // Not enough time left for another call: hand the rest back to the queue.
      if (context.getRemainingTimeInMillis() < options.callTimeoutMs + margin) {
        failures.push({ itemIdentifier: record.messageId });
        continue;
      }
      try {
        const task = JSON.parse(record.body) as PartnerTask;
        await call(task, AbortSignal.timeout(options.callTimeoutMs));
      } catch (err) {
        console.warn(JSON.stringify({ msg: 'partner call failed', messageId: record.messageId, error: String(err) }));
        failures.push({ itemIdentifier: record.messageId });
      }
    }

    return { batchItemFailures: failures };
  };
}

/** Calls a partner via HTTP. A slow partner is cut off by the AbortSignal. */
export function httpPartner(baseUrl: string, path: string): PartnerCall {
  return async (task, signal) => {
    const res = await fetch(new URL(path, baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': `${task.bookingId}-${task.partner}` },
      body: JSON.stringify(task.payload),
      signal,
    });
    if (!res.ok) throw new Error(`partner answered with ${res.status}`);
  };
}
