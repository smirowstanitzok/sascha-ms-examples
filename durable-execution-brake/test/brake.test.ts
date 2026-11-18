// test/brake.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { clientToken, pauseAll, purgeFinished, resumeAll, summarize } from "../src/brake.ts";

type Call = { command: string; input: Record<string, unknown> };

// Real client with a replaced send(): answers list calls from a table
// and records everything else. No AWS access needed.
function fakeClient(executions: { name: string; status: string }[], failOn: Record<string, string> = {}) {
  const calls: Call[] = [];
  const client = new LambdaClient({ region: "eu-central-1" });
  const send = async (cmd: { constructor: { name: string }; input: Record<string, unknown> }) => {
    const command = cmd.constructor.name;
    calls.push({ command, input: cmd.input });
    if (command === "ListDurableExecutionsByFunctionCommand") {
      const wanted = cmd.input.Statuses as string[];
      return {
        DurableExecutions: executions
          .filter((e) => wanted.includes(e.status))
          .map((e) => ({
            DurableExecutionArn: `arn:aws:lambda:eu-central-1:111122223333:function:bookshop-orders:7/durable-execution/${e.name}/id-${e.name}`,
            DurableExecutionName: e.name,
            Status: e.status,
          })),
      };
    }
    const name = String(cmd.input.DurableExecutionArn).split("/")[2];
    if (failOn[name]) {
      const err = new Error("simulated");
      err.name = failOn[name];
      throw err;
    }
    return {};
  };
  client.send = send as unknown as LambdaClient["send"];
  return { client, calls };
}

const target = { functionName: "bookshop-orders" };

test("pause only touches running executions and records the reason", async () => {
  const { client, calls } = fakeClient([
    { name: "order-1", status: "RUNNING" },
    { name: "order-2", status: "RUNNING" },
    { name: "order-3", status: "SUCCEEDED" },
  ]);
  const results = await pauseAll(client, target, { reason: "Payment provider outage" });
  assert.deepEqual(summarize(results), { done: 2, "dry-run": 0, skipped: 0, failed: 0 });
  const pauses = calls.filter((c) => c.command === "PauseDurableExecutionCommand");
  assert.equal(pauses.length, 2);
  assert.equal(pauses[0].input.Reason, "Payment provider outage");
  assert.equal(pauses[0].input.ExecutionTimeoutPaused, true);
});

test("dry run lists but does not pause", async () => {
  const { client, calls } = fakeClient([{ name: "order-1", status: "RUNNING" }]);
  const results = await pauseAll(client, target, { reason: "Test", dryRun: true });
  assert.equal(results[0].outcome, "dry-run");
  assert.equal(
    calls.some((c) => c.command === "PauseDurableExecutionCommand"),
    false,
  );
});

test("an execution that finished in the meantime counts as skipped", async () => {
  const { client } = fakeClient([{ name: "order-1", status: "RUNNING" }], {
    "order-1": "ResourceConflictException",
  });
  const [result] = await pauseAll(client, target, { reason: "Outage" });
  assert.equal(result.outcome, "skipped");
});

test("resume picks up PAUSED and PAUSING executions", async () => {
  const { client, calls } = fakeClient([
    { name: "order-1", status: "PAUSED" },
    { name: "order-2", status: "PAUSING" },
    { name: "order-3", status: "RUNNING" },
  ]);
  const results = await resumeAll(client, target, { reason: "Payment provider back" });
  assert.equal(results.length, 2);
  assert.equal(calls.filter((c) => c.command === "ResumeDurableExecutionCommand").length, 2);
});

test("purge deletes nothing without confirmation", async () => {
  const { client, calls } = fakeClient([{ name: "order-9", status: "FAILED" }]);
  const results = await purgeFinished(client, target, {
    startedBefore: new Date("2026-10-01"),
    confirm: false,
  });
  assert.equal(results[0].outcome, "dry-run");
  assert.equal(
    calls.some((c) => c.command === "DeleteDurableExecutionCommand"),
    false,
  );
});

test("purge with confirmation deletes only finished executions", async () => {
  const { client, calls } = fakeClient([
    { name: "order-9", status: "FAILED" },
    { name: "order-10", status: "SUCCEEDED" },
    { name: "order-11", status: "RUNNING" },
  ]);
  const results = await purgeFinished(client, target, {
    startedBefore: new Date("2026-10-01"),
    confirm: true,
  });
  assert.equal(summarize(results).done, 2);
  const list = calls.find((c) => c.command === "ListDurableExecutionsByFunctionCommand")!;
  assert.deepEqual(list.input.Statuses, ["SUCCEEDED", "FAILED", "STOPPED", "TIMED_OUT"]);
});

test("same ARN and reason produce the same client token", () => {
  const a = clientToken("arn:x", "pause", "Outage");
  assert.equal(a, clientToken("arn:x", "pause", "Outage"));
  assert.notEqual(a, clientToken("arn:x", "resume", "Outage"));
  assert.equal(a.length, 32);
});
