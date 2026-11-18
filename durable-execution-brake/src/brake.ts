// src/brake.ts
import { createHash } from "node:crypto";
import {
  DeleteDurableExecutionCommand,
  LambdaClient,
  PauseDurableExecutionCommand,
  ResumeDurableExecutionCommand,
  paginateListDurableExecutionsByFunction,
  type ExecutionStatus,
} from "@aws-sdk/client-lambda";

export type Outcome = "done" | "dry-run" | "skipped" | "failed";

export interface ExecutionResult {
  arn: string;
  name: string;
  outcome: Outcome;
  detail?: string;
}

export interface Target {
  functionName: string;
  qualifier?: string; // version or alias, e.g. "live"
}

// Lists all executions of a function with the given statuses (all pages).
export async function listExecutions(
  client: LambdaClient,
  target: Target,
  statuses: ExecutionStatus[],
  startedBefore?: Date,
) {
  const found: { arn: string; name: string; status: string }[] = [];
  const pages = paginateListDurableExecutionsByFunction(
    { client, pageSize: 100 },
    {
      FunctionName: target.functionName,
      Qualifier: target.qualifier,
      Statuses: statuses,
      StartedBefore: startedBefore,
    },
  );
  for await (const page of pages) {
    for (const e of page.DurableExecutions ?? []) {
      found.push({
        arn: e.DurableExecutionArn!,
        name: e.DurableExecutionName!,
        status: e.Status!,
      });
    }
  }
  return found;
}

// Same ARN + same reason => same token. Repeating a run within
// 15 minutes then does not cause a second pause request.
export function clientToken(arn: string, action: string, reason: string) {
  return createHash("sha256").update(`${action}|${arn}|${reason}`).digest("hex").slice(0, 32);
}

// Runs at most `limit` tasks at once so we stay below the API rate limits.
async function inPool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function errorName(err: unknown) {
  return err instanceof Error ? err.name : "UnknownError";
}

export interface PauseOptions {
  reason: string;
  dryRun?: boolean;
  keepTimeoutRunning?: boolean; // default: the execution timeout pauses as well
  concurrency?: number;
}

export async function pauseAll(client: LambdaClient, target: Target, opts: PauseOptions) {
  const running = await listExecutions(client, target, ["RUNNING"]);
  return inPool(running, opts.concurrency ?? 5, async (e): Promise<ExecutionResult> => {
    if (opts.dryRun) return { arn: e.arn, name: e.name, outcome: "dry-run" };
    try {
      await client.send(
        new PauseDurableExecutionCommand({
          DurableExecutionArn: e.arn,
          Reason: opts.reason,
          ExecutionTimeoutPaused: !opts.keepTimeoutRunning,
          ClientToken: clientToken(e.arn, "pause", opts.reason),
        }),
      );
      return { arn: e.arn, name: e.name, outcome: "done" };
    } catch (err) {
      // The execution finished between listing and pausing: nothing to do.
      if (errorName(err) === "ResourceConflictException") {
        return { arn: e.arn, name: e.name, outcome: "skipped", detail: "no longer running" };
      }
      return { arn: e.arn, name: e.name, outcome: "failed", detail: errorName(err) };
    }
  });
}

export interface ResumeOptions {
  reason: string;
  dryRun?: boolean;
  concurrency?: number;
}

export async function resumeAll(client: LambdaClient, target: Target, opts: ResumeOptions) {
  const paused = await listExecutions(client, target, ["PAUSED", "PAUSING"]);
  return inPool(paused, opts.concurrency ?? 5, async (e): Promise<ExecutionResult> => {
    if (opts.dryRun) return { arn: e.arn, name: e.name, outcome: "dry-run" };
    try {
      await client.send(
        new ResumeDurableExecutionCommand({
          DurableExecutionArn: e.arn,
          Reason: opts.reason,
          ClientToken: clientToken(e.arn, "resume", opts.reason),
        }),
      );
      return { arn: e.arn, name: e.name, outcome: "done" };
    } catch (err) {
      // Pause not processed yet: try again in a few seconds.
      if (errorName(err) === "ResourceConflictException") {
        return { arn: e.arn, name: e.name, outcome: "skipped", detail: "pause still pending, run again" };
      }
      return { arn: e.arn, name: e.name, outcome: "failed", detail: errorName(err) };
    }
  });
}

export interface PurgeOptions {
  startedBefore: Date;
  confirm: boolean; // without confirmation we only show what would be deleted
  concurrency?: number;
}

const TERMINAL: ExecutionStatus[] = ["SUCCEEDED", "FAILED", "STOPPED", "TIMED_OUT"];

export async function purgeFinished(client: LambdaClient, target: Target, opts: PurgeOptions) {
  const finished = await listExecutions(client, target, TERMINAL, opts.startedBefore);
  return inPool(finished, opts.concurrency ?? 5, async (e): Promise<ExecutionResult> => {
    if (!opts.confirm) return { arn: e.arn, name: e.name, outcome: "dry-run" };
    try {
      await client.send(new DeleteDurableExecutionCommand({ DurableExecutionArn: e.arn }));
      return { arn: e.arn, name: e.name, outcome: "done" };
    } catch (err) {
      // Just finished (eventually consistent) or already deleted.
      if (["ResourceConflictException", "ResourceNotFoundException"].includes(errorName(err))) {
        return { arn: e.arn, name: e.name, outcome: "skipped", detail: errorName(err) };
      }
      return { arn: e.arn, name: e.name, outcome: "failed", detail: errorName(err) };
    }
  });
}

export function summarize(results: ExecutionResult[]) {
  const count: Record<Outcome, number> = { done: 0, "dry-run": 0, skipped: 0, failed: 0 };
  for (const r of results) count[r.outcome]++;
  return count;
}
