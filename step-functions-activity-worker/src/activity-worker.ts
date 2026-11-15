// src/activity-worker.ts
import {
  GetActivityTaskCommand,
  SendTaskFailureCommand,
  SendTaskHeartbeatCommand,
  SendTaskSuccessCommand,
  SFNClient,
  TaskTimedOut,
} from '@aws-sdk/client-sfn';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Agent } from 'node:https';
import { setTimeout as sleep } from 'node:timers/promises';

export type JobHandler = (input: unknown, signal: AbortSignal) => Promise<unknown>;

export interface WorkerOptions {
  activityArn: string;
  workerName: string;
  /** How many GetActivityTask calls may be open at the same time */
  pollers: number;
  /** How many tasks the machine processes at the same time */
  maxParallelJobs: number;
  /** Heartbeat interval, well below heartbeatTimeout */
  heartbeatMs: number;
}

export function createSfnClient(region?: string, maxSockets = 50): SFNClient {
  return new SFNClient({
    region,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 5_000,
      // Step Functions holds a poll open for up to 60 s – leave some headroom
      requestTimeout: 70_000,
      httpsAgent: new Agent({ keepAlive: true, maxSockets }),
    }),
  });
}

class Slots {
  private waiters: Array<() => void> = [];
  constructor(private free: number) {}

  async acquire(): Promise<void> {
    if (this.free > 0) {
      this.free--;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  release(): void {
    const next = this.waiters.shift();
    if (next) next();
    else this.free++;
  }
}

export class ActivityWorker {
  private stopping = false;
  private readonly running = new Set<Promise<void>>();
  private readonly slots: Slots;

  constructor(
    private readonly client: SFNClient,
    private readonly opts: WorkerOptions,
    private readonly handler: JobHandler,
  ) {
    this.slots = new Slots(opts.maxParallelJobs);
  }

  async run(): Promise<void> {
    const loops = Array.from({ length: this.opts.pollers }, (_, i) => this.pollLoop(i));
    await Promise.all(loops);
    await Promise.allSettled([...this.running]);
  }

  /** Start no new polls; let running polls and tasks finish cleanly */
  stop(): void {
    this.stopping = true;
  }

  private async pollLoop(index: number): Promise<void> {
    let failures = 0;
    while (!this.stopping) {
      // Only poll when we can process a task right away
      await this.slots.acquire();
      if (this.stopping) {
        this.slots.release();
        break;
      }

      let taskToken: string | undefined;
      let input = '{}';
      try {
        const task = await this.client.send(
          new GetActivityTaskCommand({
            activityArn: this.opts.activityArn,
            workerName: `${this.opts.workerName}-${index}`,
          }),
        );
        taskToken = task.taskToken || undefined;
        input = task.input ?? '{}';
        failures = 0;
      } catch (err) {
        this.slots.release();
        failures++;
        console.error(`[poller ${index}] GetActivityTask failed:`, (err as Error).name);
        await sleep(Math.min(30_000, 500 * 2 ** failures));
        continue;
      }

      if (!taskToken) {
        // No work for 60 s: simply poll again
        this.slots.release();
        continue;
      }

      const job = this.process(taskToken, input).finally(() => {
        this.slots.release();
        this.running.delete(job);
      });
      this.running.add(job);
    }
  }

  private async process(taskToken: string, rawInput: string): Promise<void> {
    const abort = new AbortController();
    const heartbeat = setInterval(() => {
      this.client.send(new SendTaskHeartbeatCommand({ taskToken })).catch((err) => {
        // Token expired: Step Functions is no longer waiting for us
        if (err instanceof TaskTimedOut) abort.abort(err);
      });
    }, this.opts.heartbeatMs);

    try {
      const output = await this.handler(JSON.parse(rawInput), abort.signal);
      await this.client.send(
        new SendTaskSuccessCommand({ taskToken, output: JSON.stringify(output ?? {}) }),
      );
    } catch (err) {
      if (err instanceof TaskTimedOut || abort.signal.aborted) {
        console.warn('Task token expired, discarding result');
        return;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      await this.client
        .send(
          new SendTaskFailureCommand({
            taskToken,
            error: error.name.slice(0, 256),
            cause: error.message.slice(0, 32_768),
          }),
        )
        .catch((sendErr) => console.error('SendTaskFailure failed:', sendErr.name));
    } finally {
      clearInterval(heartbeat);
    }
  }
}
