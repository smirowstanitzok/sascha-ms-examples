import { test } from "node:test";
import assert from "node:assert/strict";
import { replayStream, orderShards } from "../src/replay";

const t = (s: string) => new Date(s);
const rec = (id: string, at: string) => ({ eventID: id, eventName: "INSERT" as const, dynamodb: { ApproximateCreationDateTime: t(at) } });

test("parent shards come before child shards", () => {
  const ordered = orderShards([
    { ShardId: "child", ParentShardId: "parent" },
    { ShardId: "parent" },
  ]);
  assert.deepEqual(ordered.map((s) => s.ShardId), ["parent", "child"]);
});

test("reads from 'from' and stops at 'until'", async () => {
  const calls: string[] = [];
  const pages: Record<string, { Records: ReturnType<typeof rec>[]; NextShardIterator?: string }> = {
    "it-parent": { Records: [rec("a", "2026-10-22T10:00:00Z"), rec("b", "2026-10-22T10:05:00Z")] }, // closed
    "it-child": { Records: [rec("c", "2026-10-22T10:10:00Z"), rec("d", "2026-10-22T12:00:00Z")], NextShardIterator: "it-x" },
  };
  const client = {
    send: async (cmd: any) => {
      const name = cmd.constructor.name;
      calls.push(name);
      if (name === "DescribeStreamCommand") return { StreamDescription: { Shards: [
        { ShardId: "child", ParentShardId: "parent", SequenceNumberRange: {} },
        { ShardId: "parent", SequenceNumberRange: { EndingSequenceNumber: "9" } },
      ] } };
      if (name === "GetShardIteratorCommand") {
        assert.equal(cmd.input.ShardIteratorType, "AT_TIMESTAMP");
        return { ShardIterator: `it-${cmd.input.ShardId}` };
      }
      if (name === "GetRecordsCommand") return pages[cmd.input.ShardIterator];
      throw new Error(name);
    },
  };
  const seen: string[] = [];
  const n = await replayStream({
    streamArn: "arn:test", from: t("2026-10-22T09:00:00Z"), until: t("2026-10-22T11:00:00Z"),
    client: client as any, handle: async (rs) => { seen.push(...rs.map((r) => r.eventID!)); },
  });
  assert.equal(n, 3);
  assert.deepEqual(seen, ["a", "b", "c"]);
});

test("open shard without new data ends after maxEmptyPolls", async () => {
  let polls = 0;
  const client = { send: async (cmd: any) => {
    const name = cmd.constructor.name;
    if (name === "DescribeStreamCommand") return { StreamDescription: { Shards: [{ ShardId: "open", SequenceNumberRange: {} }] } };
    if (name === "GetShardIteratorCommand") return { ShardIterator: "it" };
    polls++; return { Records: [], NextShardIterator: "it" };
  } };
  const n = await replayStream({ streamArn: "arn:test", from: new Date(Date.now() - 60_000), client: client as any, handle: async () => {}, maxEmptyPolls: 2 });
  assert.equal(n, 0);
  assert.equal(polls, 2);
});
