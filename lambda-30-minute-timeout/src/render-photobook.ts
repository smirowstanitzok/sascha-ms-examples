// src/render-photobook.ts
import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import type { CheckpointStore } from './checkpoint-store.ts';

export interface PhotoBookOrder {
  orderId: string;
  pageCount: number;
  continuation?: number;
}

export interface RenderDeps {
  store: CheckpointStore;
  renderPage: (orderId: string, page: number) => Promise<void>;
  requeue: (order: PhotoBookOrder) => Promise<void>;
  safetyMarginMs: number;
  checkpointEvery: number;
  maxContinuations: number;
}

// Only this method of the Lambda context is needed
export interface TimeBudget {
  getRemainingTimeInMillis(): number;
}

export type RenderResult = 'done' | 'paused' | 'skipped';

export function createHandler(deps: RenderDeps) {
  return async (event: SQSEvent, context: TimeBudget): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

    for (const record of event.Records) {
      try {
        const order = parseOrder(record.body);
        const result = await renderOrder(order, deps, context);
        console.log(JSON.stringify({ orderId: order.orderId, result }));
      } catch (error) {
        console.error(JSON.stringify({ messageId: record.messageId, error: String(error) }));
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }

    return { batchItemFailures };
  };
}

export async function renderOrder(
  order: PhotoBookOrder,
  deps: RenderDeps,
  budget: TimeBudget,
): Promise<RenderResult> {
  const checkpoint = await deps.store.load(order.orderId);
  if (checkpoint.done) return 'skipped'; // message was delivered twice

  let page = checkpoint.nextPage;
  while (page <= order.pageCount) {
    // Stop in time instead of being killed by the timeout
    if (budget.getRemainingTimeInMillis() < deps.safetyMarginMs) {
      await deps.store.save(order.orderId, page);
      const continuation = (order.continuation ?? 0) + 1;
      if (continuation > deps.maxContinuations) {
        throw new Error(`Order ${order.orderId}: too many continuations`);
      }
      await deps.requeue({ ...order, continuation });
      return 'paused';
    }

    await deps.renderPage(order.orderId, page);
    page += 1;

    if ((page - 1) % deps.checkpointEvery === 0) {
      await deps.store.save(order.orderId, page);
    }
  }

  await deps.store.finish(order.orderId);
  return 'done';
}

function parseOrder(body: string): PhotoBookOrder {
  const data = JSON.parse(body) as Partial<PhotoBookOrder>;
  if (typeof data.orderId !== 'string' || !Number.isInteger(data.pageCount) || (data.pageCount ?? 0) < 1) {
    throw new Error('Invalid order message');
  }
  return { orderId: data.orderId, pageCount: data.pageCount as number, continuation: data.continuation ?? 0 };
}
