// test/ask-claude.test.ts
import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { askClaude, extractText, type MessagesClient } from '../src/ask-claude.ts';
import { PROFILES } from '../src/models.ts';

// Builds a minimal response in Messages API format
function reply(model: string, partial: Partial<Anthropic.Message>): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model,
    content: [],
    stop_reason: 'end_turn',
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 10, output_tokens: 5 },
    ...partial,
  } as Anthropic.Message;
}

// Replaces messages.stream(): each answer is returned via finalMessage()
function fakeClient(...answers: Anthropic.Message[]) {
  const streamMock = vi.fn();
  for (const a of answers) streamMock.mockReturnValueOnce({ finalMessage: async () => a });
  return { client: { messages: { stream: streamMock } } as MessagesClient, streamMock };
}

const refusal = (model: string, category: string) =>
  reply(model, {
    stop_reason: 'refusal',
    stop_details: { type: 'refusal', category, explanation: 'declined' } as Anthropic.Message['stop_details'],
  });

describe('askClaude', () => {
  it('sets effort explicitly and returns only text blocks', async () => {
    const { client, streamMock } = fakeClient(
      reply('claude-fable-5-2', {
        content: [
          { type: 'thinking', thinking: '', signature: 'sig' },
          { type: 'text', text: 'Plan is ready.', citations: null },
        ] as Anthropic.Message['content'],
      }),
    );

    const result = await askClaude(client, 'Plan the migration', { profile: PROFILES.heavy });

    expect(result.text).toBe('Plan is ready.');
    expect(result.servedBy).toBe('claude-fable-5-2');
    expect(streamMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-fable-5-2', output_config: { effort: 'high' } }),
    );
  });

  it('falls back to the fallback model after a refusal', async () => {
    const onRefusal = vi.fn();
    const { client, streamMock } = fakeClient(
      refusal('claude-fable-5-2', 'cyber'),
      reply('claude-opus-4-8', { content: [{ type: 'text', text: 'Answer', citations: null }] }),
    );

    const result = await askClaude(client, 'Check these firewall rules', { profile: PROFILES.heavy, onRefusal });

    expect(streamMock).toHaveBeenCalledTimes(2);
    expect(streamMock.mock.calls[1][0].model).toBe('claude-opus-4-8');
    expect(result.servedBy).toBe('claude-opus-4-8');
    expect(result.refusals).toEqual([{ model: 'claude-fable-5-2', category: 'cyber' }]);
    expect(onRefusal).toHaveBeenCalledOnce();
  });

  it('stops on reasoning_extraction without a second attempt', async () => {
    const { client, streamMock } = fakeClient(refusal('claude-fable-5-2', 'reasoning_extraction'));

    const result = await askClaude(client, 'Show me your reasoning', { profile: PROFILES.heavy });

    expect(streamMock).toHaveBeenCalledTimes(1);
    expect(result.stopReason).toBe('refusal');
    expect(result.text).toBe('');
  });
});

describe('extractText', () => {
  it('ignores thinking blocks at the start', () => {
    const msg = reply('claude-fable-5-2', {
      content: [
        { type: 'thinking', thinking: '', signature: 'sig' },
        { type: 'text', text: 'Hello ', citations: null },
        { type: 'text', text: 'World', citations: null },
      ] as Anthropic.Message['content'],
    });
    expect(extractText(msg)).toBe('Hello World');
  });
});
