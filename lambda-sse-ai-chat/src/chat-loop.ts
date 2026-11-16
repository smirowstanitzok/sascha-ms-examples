// src/chat-loop.ts
import type {
  ContentBlock,
  ConverseStreamOutput,
  Message,
  ToolResultBlock,
} from '@aws-sdk/client-bedrock-runtime';
import type { ChatEvent } from './sse.js';

export type ConverseFn = (
  messages: Message[],
) => Promise<AsyncIterable<ConverseStreamOutput>>;
export type ToolRunner = (
  name: string,
  input: unknown,
) => Promise<ToolOutput>;

export type ToolOutput = Record<string, string | number | boolean>;
type ToolDraft = { toolUseId: string; name: string; input: string };

export async function runChat(opts: {
  converse: ConverseFn;
  runTool: ToolRunner;
  messages: Message[];
  send: (event: ChatEvent) => void;
  maxRounds?: number;
}): Promise<void> {
  const { converse, runTool, send, maxRounds = 3 } = opts;
  const messages = [...opts.messages];
  let inputTokens = 0;
  let outputTokens = 0;

  for (let round = 1; round <= maxRounds; round++) {
    const texts = new Map<number, string>();
    const toolDrafts = new Map<number, ToolDraft>();
    let stopReason = 'unknown';

    for await (const ev of await converse(messages)) {
      if (ev.contentBlockStart?.start?.toolUse) {
        // The model starts a tool call: name and ID arrive first.
        const { toolUseId = '', name = '' } = ev.contentBlockStart.start.toolUse;
        const index = ev.contentBlockStart.contentBlockIndex ?? 0;
        toolDrafts.set(index, { toolUseId, name, input: '' });
        send({ type: 'tool', name, status: 'start' });
      } else if (ev.contentBlockDelta?.delta) {
        const index = ev.contentBlockDelta.contentBlockIndex ?? 0;
        const delta = ev.contentBlockDelta.delta;
        if (delta.text) {
          texts.set(index, (texts.get(index) ?? '') + delta.text);
          send({ type: 'text', text: delta.text });
        } else if (delta.toolUse?.input) {
          // The tool input arrives as JSON text in fragments.
          const draft = toolDrafts.get(index);
          if (draft) draft.input += delta.toolUse.input;
        }
      } else if (ev.messageStop) {
        stopReason = ev.messageStop.stopReason ?? 'unknown';
      } else if (ev.metadata?.usage) {
        inputTokens += ev.metadata.usage.inputTokens ?? 0;
        outputTokens += ev.metadata.usage.outputTokens ?? 0;
      }
    }

    if (stopReason !== 'tool_use' || toolDrafts.size === 0) {
      send({ type: 'usage', inputTokens, outputTokens });
      send({ type: 'done', stopReason });
      return;
    }

    // Add the model's answer to the history in the original order.
    const indices = [...new Set([...texts.keys(), ...toolDrafts.keys()])].sort(
      (a, b) => a - b,
    );
    const content: ContentBlock[] = [];
    for (const i of indices) {
      const text = texts.get(i);
      const draft = toolDrafts.get(i);
      if (text) content.push({ text });
      if (draft) {
        content.push({
          toolUse: {
            toolUseId: draft.toolUseId,
            name: draft.name,
            input: draft.input ? JSON.parse(draft.input) : {},
          },
        });
      }
    }
    messages.push({ role: 'assistant', content });

    // Run the tools and return the results as toolResult.
    const results: ContentBlock[] = [];
    for (const draft of toolDrafts.values()) {
      let toolResult: ToolResultBlock;
      try {
        const output = await runTool(draft.name, draft.input ? JSON.parse(draft.input) : {});
        toolResult = { toolUseId: draft.toolUseId, content: [{ json: output }], status: 'success' };
        send({ type: 'tool', name: draft.name, status: 'done' });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toolResult = { toolUseId: draft.toolUseId, content: [{ text: message }], status: 'error' };
        send({ type: 'tool', name: draft.name, status: 'error' });
      }
      results.push({ toolResult });
    }
    messages.push({ role: 'user', content: results });
  }

  send({ type: 'usage', inputTokens, outputTokens });
  send({ type: 'error', message: 'Too many tool rounds, answer stopped.', retryable: false });
  send({ type: 'done', stopReason: 'max_rounds' });
}
