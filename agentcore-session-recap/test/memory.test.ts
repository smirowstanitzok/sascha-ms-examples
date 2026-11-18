// test/memory.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FULL_SESSION_FILTER,
  assertId,
  customerHistory,
  recentTurns,
  sessionIdFromNamespace,
  sessionRecap,
  type MemoryClient,
} from "../src/memory.ts";
import { buildSystemPrompt, toConverseMessages } from "../src/prompt.ts";

// Fake client: returns prepared responses in order and remembers the inputs.
function fakeClient(responses: unknown[]): MemoryClient & { inputs: any[] } {
  const inputs: any[] = [];
  return {
    inputs,
    async send(command: any) {
      inputs.push(command.input);
      return responses.shift() ?? {};
    },
  };
}

test("filter targets the system record type FULL_SESSION", () => {
  assert.equal(FULL_SESSION_FILTER.left?.metadataKey, "x-amz-agentcore-memory-recordType");
  assert.deepEqual(FULL_SESSION_FILTER.right?.metadataValue, { stringValue: "FULL_SESSION" });
});

test("assertId rejects slashes so namespaces stay intact", () => {
  assert.equal(assertId("customer_42", "customerId"), "customer_42");
  assert.throws(() => assertId("customer/42", "customerId"), /Invalid customerId/);
  assert.throws(() => assertId(undefined, "sessionId"), /Invalid sessionId/);
});

test("sessionIdFromNamespace reads the session from the namespace", () => {
  assert.equal(sessionIdFromNamespace("/summaries/customer_42/s-2026-11-18/"), "s-2026-11-18");
  assert.equal(sessionIdFromNamespace("/other/customer_42/"), undefined);
});

test("sessionRecap queries the exact namespace with the filter", async () => {
  const client = fakeClient([{ memoryRecordSummaries: [{ content: { text: "Customer asked about e-bike rental." } }] }]);
  const recap = await sessionRecap(client, "mem-1", "customer_42", "s1");
  assert.equal(recap, "Customer asked about e-bike rental.");
  assert.equal(client.inputs[0].namespace, "/summaries/customer_42/s1/");
  assert.deepEqual(client.inputs[0].metadataFilters, [FULL_SESSION_FILTER]);
});

test("customerHistory pages through results and sorts newest first", async () => {
  const client = fakeClient([
    {
      memoryRecordSummaries: [
        { namespaces: ["/summaries/customer_42/a/"], content: { text: "Old" }, createdAt: new Date("2026-03-01") },
      ],
      nextToken: "page-2",
    },
    {
      memoryRecordSummaries: [
        { namespaces: ["/summaries/customer_42/b/"], content: { text: "New" }, createdAt: new Date("2026-11-01") },
        { namespaces: ["/summaries/customer_42/c/"], content: {}, createdAt: new Date("2026-11-02") },
      ],
    },
  ]);
  const entries = await customerHistory(client, "mem-1", "customer_42", 5);
  assert.deepEqual(entries.map((e) => e.sessionId), ["b", "a"]);
  assert.equal(client.inputs[0].namespacePath, "/summaries/customer_42/");
  assert.equal(client.inputs[1].nextToken, "page-2");
});

test("recentTurns sorts by time and ignores non-chat payloads", async () => {
  const client = fakeClient([
    {
      events: [
        { eventTimestamp: new Date("2026-11-18T10:01:00Z"), payload: [{ conversational: { role: "ASSISTANT", content: { text: "Sure!" } } }] },
        { eventTimestamp: new Date("2026-11-18T10:00:00Z"), payload: [{ conversational: { role: "USER", content: { text: "Can I extend?" } } }] },
        { eventTimestamp: new Date("2026-11-18T10:02:00Z"), payload: [{ blob: "x" }] },
      ],
    },
  ]);
  const turns = await recentTurns(client, "mem-1", "customer_42", "s1");
  assert.deepEqual(turns, [
    { role: "USER", text: "Can I extend?" },
    { role: "ASSISTANT", text: "Sure!" },
  ]);
});

test("toConverseMessages merges same roles and starts with user", () => {
  const messages = toConverseMessages(
    [
      { role: "ASSISTANT", text: "Welcome back!" },
      { role: "USER", text: "Hi" },
      { role: "USER", text: "Quick question" },
      { role: "ASSISTANT", text: "Go ahead" },
    ],
    "Is the cargo bike free on Saturday?",
  );
  assert.deepEqual(messages.map((m) => m.role), ["user", "assistant", "user"]);
  assert.equal(messages[0]?.content?.[0]?.text, "Hi\nQuick question");
});

test("buildSystemPrompt leaves out the current session", () => {
  const prompt = buildSystemPrompt(
    [
      { sessionId: "now", text: "Current", updatedAt: new Date("2026-11-18") },
      { sessionId: "old", text: "Rented a cargo bike,\n returned it late.", updatedAt: new Date("2026-04-02") },
    ],
    "now",
  );
  assert.match(prompt, /2026-04-02: Rented a cargo bike, returned it late\./);
  assert.doesNotMatch(prompt, /Current/);
});
