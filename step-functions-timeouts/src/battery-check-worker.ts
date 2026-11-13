// src/battery-check-worker.ts
import type { Context, SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { SFNClient, SendTaskFailureCommand, SendTaskSuccessCommand } from '@aws-sdk/client-sfn';
import { BikeOfflineError, runBatteryDiagnosis, type BatteryReport } from './battery-diagnosis.js';
import { isTaskGone, runWithHeartbeat, TaskGoneError } from './heartbeat.js';

export interface CheckRequest {
  taskToken: string;
  rentalId: string;
  bikeId: string;
}

export interface WorkerDeps {
  client: Pick<SFNClient, 'send'>;
  diagnose: (bikeId: string, signal: AbortSignal) => Promise<BatteryReport>;
  heartbeatIntervalMs: number;
  budgetMs: number;
}

/** Aborted promises (e.g. from timers/promises) wrap the reason in `cause`. */
function rootCause(err: unknown): unknown {
  return err instanceof Error && err.name === 'AbortError' && err.cause ? err.cause : err;
}

/** Maps an error to the error name the state machine evaluates. */
function errorName(err: unknown): string {
  if (err instanceof BikeOfflineError) return 'BatteryCheck.BikeOffline';
  if (err instanceof Error && err.name === 'TimeoutError') return 'BatteryCheck.TooSlow';
  return 'BatteryCheck.Unexpected';
}

export async function processCheck(req: CheckRequest, deps: WorkerDeps): Promise<'success' | 'failure' | 'gone'> {
  const { client } = deps;
  const { taskToken } = req;
  try {
    const report = await runWithHeartbeat(
      (signal) => deps.diagnose(req.bikeId, AbortSignal.any([signal, AbortSignal.timeout(deps.budgetMs)])),
      { taskToken, intervalMs: deps.heartbeatIntervalMs, client },
    );
    await client.send(new SendTaskSuccessCommand({ taskToken, output: JSON.stringify(report) }));
    return 'success';
  } catch (caught) {
    const err = rootCause(caught);
    if (err instanceof TaskGoneError || isTaskGone(err)) {
      // The workflow has moved on (timeout). Drop the message, report nothing.
      console.warn(`Task for rental ${req.rentalId} is no longer active`);
      return 'gone';
    }
    await client.send(
      new SendTaskFailureCommand({
        taskToken,
        error: errorName(err),
        cause: err instanceof Error ? err.message : String(err),
      }),
    );
    return 'failure';
  }
}

const sfn = new SFNClient({});

export const handler = async (event: SQSEvent, context: Context): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];
  for (const record of event.Records) {
    try {
      await processCheck(JSON.parse(record.body) as CheckRequest, {
        client: sfn,
        diagnose: runBatteryDiagnosis,
        heartbeatIntervalMs: Number(process.env.HEARTBEAT_INTERVAL_MS ?? '20000'),
        // 10 seconds of headroom so SendTaskFailure still gets through
        budgetMs: context.getRemainingTimeInMillis() - 10_000,
      });
    } catch (err) {
      // Only if even SendTaskSuccess/-Failure fails: redeliver the message later
      console.error('Reporting back to Step Functions failed', err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
};
