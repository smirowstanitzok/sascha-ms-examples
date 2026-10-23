// src/classify.ts
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

const anthropic = new Anthropic();

const Ticket = z.object({
  category: z.enum(['bug', 'feature', 'question']),
  priority: z.enum(['low', 'medium', 'high']),
  summary: z.string(),
});

export type Ticket = z.infer<typeof Ticket>;

export async function classifyTicket(text: string): Promise<Ticket> {
  const message = await anthropic.messages.parse({
    model: 'claude-sonnet-5-5',
    max_tokens: 400,
    system: [
      'You classify support tickets.',
      'Rules: crash or data loss = bug/high.',
      'Request for a new feature = feature/low, unless the text mentions a deadline.',
      'Everything else = question/medium.',
    ].join('\n'),
    messages: [{ role: 'user', content: text }],
    output_config: { format: zodOutputFormat(Ticket) },
  });

  if (!message.parsed_output) {
    throw new Error(`No valid response (stop_reason: ${message.stop_reason})`);
  }
  return message.parsed_output;
}
