// test/chat-loop.test.ts
import type { ConverseStreamOutput, Message } from '@aws-sdk/client-bedrock-runtime';
import { describe, expect, it } from 'vitest';
import { runChat } from '../src/chat-loop.js';
import type { ChatEvent } from '../src/sse.js';
import { runTool } from '../src/tools.js';

async function* from(events: ConverseStreamOutput[]) {
  for (const e of events) yield e;
}

// Round 1: short text, then a tool call. Round 2: the actual answer.
const round1: ConverseStreamOutput[] = [
  { messageStart: { role: 'assistant' } },
  { contentBlockDelta: { contentBlockIndex: 0, delta: { text: 'Let me check. ' } } },
  { contentBlockStop: { contentBlockIndex: 0 } },
  {
    contentBlockStart: {
      contentBlockIndex: 1,
      start: { toolUse: { toolUseId: 'tu-1', name: 'check_availability' } },
    },
  },
  { contentBlockDelta: { contentBlockIndex: 1, delta: { toolUse: { input: '{"station":"lin' } } } },
  { contentBlockDelta: { contentBlockIndex: 1, delta: { toolUse: { input: 'dau","bikeType":"ebike"}' } } } },
  { contentBlockStop: { contentBlockIndex: 1 } },
  { messageStop: { stopReason: 'tool_use' } },
  { metadata: { usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 }, metrics: { latencyMs: 1 } } },
];
const round2: ConverseStreamOutput[] = [
  { contentBlockDelta: { contentBlockIndex: 0, delta: { text: 'Lindau has 3 e-bikes available.' } } },
  { messageStop: { stopReason: 'end_turn' } },
  { metadata: { usage: { inputTokens: 150, outputTokens: 15, totalTokens: 165 }, metrics: { latencyMs: 1 } } },
];

describe('runChat', () => {
  it('streams text, runs the tool and sums up the tokens', async () => {
    const calls: Message[][] = [];
    const rounds = [round1, round2];
    const events: ChatEvent[] = [];

    await runChat({
      messages: [{ role: 'user', content: [{ text: 'E-bike in Lindau?' }] }],
      runTool,
      send: (e) => events.push(e),
      converse: async (messages) => {
        calls.push(structuredClone(messages));
        return from(rounds.shift()!);
      },
    });

    expect(events).toEqual([
      { type: 'text', text: 'Let me check. ' },
      { type: 'tool', name: 'check_availability', status: 'start' },
      { type: 'tool', name: 'check_availability', status: 'done' },
      { type: 'text', text: 'Lindau has 3 e-bikes available.' },
      { type: 'usage', inputTokens: 250, outputTokens: 35 },
      { type: 'done', stopReason: 'end_turn' },
    ]);

    const second = calls[1]!;
    expect(second[1]!.content).toEqual([
      { text: 'Let me check. ' },
      { toolUse: { toolUseId: 'tu-1', name: 'check_availability', input: { station: 'lindau', bikeType: 'ebike' } } },
    ]);
    expect(second[2]!.content).toEqual([
      {
        toolResult: {
          toolUseId: 'tu-1',
          content: [{ json: { station: 'lindau', bikeType: 'ebike', available: 3 } }],
          status: 'success',
        },
      },
    ]);
  });

  it('reports tool errors to the model instead of aborting', async () => {
    const events: ChatEvent[] = [];
    const calls: Message[][] = [];
    const bad = round1.map((e) =>
      e.contentBlockDelta?.delta?.toolUse
        ? { contentBlockDelta: { contentBlockIndex: 1, delta: { toolUse: { input: '' } } } }
        : e,
    );
    const rounds = [bad, round2];
    await runChat({
      messages: [{ role: 'user', content: [{ text: 'Bike available?' }] }],
      runTool,
      send: (e) => events.push(e),
      converse: async (m) => {
        calls.push(structuredClone(m));
        return from(rounds.shift()!);
      },
    });
    expect(events).toContainEqual({ type: 'tool', name: 'check_availability', status: 'error' });
    const result = calls[1]![2]!.content![0]!.toolResult!;
    expect(result.status).toBe('error');
  });

  it('stops after maxRounds', async () => {
    const events: ChatEvent[] = [];
    await runChat({
      messages: [{ role: 'user', content: [{ text: 'Endless?' }] }],
      runTool,
      send: (e) => events.push(e),
      maxRounds: 2,
      converse: async () => from(round1),
    });
    expect(events.at(-2)).toMatchObject({ type: 'error', retryable: false });
    expect(events.at(-1)).toEqual({ type: 'done', stopReason: 'max_rounds' });
  });
});
