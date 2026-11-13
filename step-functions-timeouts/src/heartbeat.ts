// src/heartbeat.ts
import { SendTaskHeartbeatCommand, type SFNClient } from '@aws-sdk/client-sfn';

/** Errors that mean: Step Functions is no longer waiting for this task. */
const TASK_GONE_ERRORS = new Set(['TaskTimedOut', 'TaskDoesNotExist', 'InvalidToken']);

export class TaskGoneError extends Error {
  constructor(reason: string) {
    super(`Step Functions is no longer waiting for this task (${reason})`);
    this.name = 'TaskGoneError';
  }
}

export function isTaskGone(err: unknown): boolean {
  return err instanceof Error && TASK_GONE_ERRORS.has(err.name);
}

export interface HeartbeatOptions {
  taskToken: string;
  intervalMs: number;
  client: Pick<SFNClient, 'send'>;
}

/**
 * Runs `work` and sends heartbeats at a regular interval meanwhile.
 * The first heartbeat goes out immediately: if the task has already expired,
 * we don't even start working.
 */
export async function runWithHeartbeat<T>(
  work: (signal: AbortSignal) => Promise<T>,
  { taskToken, intervalMs, client }: HeartbeatOptions,
): Promise<T> {
  const controller = new AbortController();

  const beat = async (): Promise<void> => {
    try {
      await client.send(new SendTaskHeartbeatCommand({ taskToken }));
    } catch (err) {
      if (isTaskGone(err)) {
        controller.abort(new TaskGoneError((err as Error).name));
        return;
      }
      // Network hiccup: simply try again at the next interval
      console.warn('Heartbeat failed, will retry at next interval', err);
    }
  };

  await beat();
  if (controller.signal.aborted) throw controller.signal.reason;

  const timer = setInterval(() => void beat(), intervalMs);
  try {
    return await work(controller.signal);
  } finally {
    clearInterval(timer);
  }
}
