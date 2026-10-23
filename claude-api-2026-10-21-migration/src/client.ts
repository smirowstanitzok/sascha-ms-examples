// src/client.ts
import Anthropic from '@anthropic-ai/sdk';

// SDK 1.x reads ANTHROPIC_API_KEY itself and sends it as a bearer token.
export const anthropic = new Anthropic({
  maxRetries: 3,
  timeout: 60_000,
});

export async function summarize(text: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5-5',
    max_tokens: 512,
    system: 'Summarize the text factually in no more than three sentences.',
    messages: [{ role: 'user', content: text }],
  });

  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}
