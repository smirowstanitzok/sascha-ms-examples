// src/ask-claude.ts
// Calls Claude, detects refusals (stop_reason "refusal") and falls back to another model.
import type Anthropic from '@anthropic-ai/sdk';
import { FALLBACK_MODELS, type ModelProfile } from './models.ts';

type StreamParams = Anthropic.MessageStreamParams;
type Message = Anthropic.Message;

// Only the one method we need – this makes the client easy to replace in tests.
// We always stream: with a large max_tokens the SDK refuses non-streaming calls.
export interface MessagesClient {
  messages: { stream(params: StreamParams): { finalMessage(): Promise<Message> } };
}

export interface RefusalRecord {
  model: string;
  category: string | null;
}

export interface AskResult {
  text: string;
  servedBy: string;
  refusals: RefusalRecord[];
  stopReason: Message['stop_reason'];
}

export interface AskOptions {
  profile: ModelProfile;
  system?: string;
  fallbackModels?: readonly string[];
  onRefusal?: (record: RefusalRecord) => void;
}

// Select text blocks by type – never content[0].text, a thinking block often comes first
export function extractText(message: Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

export async function askClaude(
  client: MessagesClient,
  prompt: string,
  options: AskOptions,
): Promise<AskResult> {
  const { profile, system, onRefusal } = options;
  const models = [profile.id, ...(options.fallbackModels ?? FALLBACK_MODELS)];
  const refusals: RefusalRecord[] = [];

  for (const model of models) {
    const message = await client.messages
      .stream({
        model,
        max_tokens: profile.maxTokens,
        output_config: { effort: profile.effort },
        ...(system ? { system } : {}),
        messages: [{ role: 'user', content: prompt }],
      })
      .finalMessage();

    if (message.stop_reason !== 'refusal') {
      return { text: extractText(message), servedBy: message.model, refusals, stopReason: message.stop_reason };
    }

    const record = { model, category: message.stop_details?.category ?? null };
    refusals.push(record);
    onRefusal?.(record);

    // Another model will not help with "reasoning_extraction" – stop right away
    if (record.category === 'reasoning_extraction') break;
  }

  return { text: '', servedBy: 'none', refusals, stopReason: 'refusal' };
}
