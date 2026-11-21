// src/tool-result.ts
import type { ContentBlock } from '@aws-sdk/client-bedrock-runtime';
import type { GuardResult, GuardSource } from './guard.ts';

type Guard = (text: string, source: GuardSource) => Promise<GuardResult>;

// Content a tool fetches from outside (e.g. reviews from a partner site)
// is just as risky for the model as user input. That is why it goes
// through the same check before it lands in the conversation as a toolResult.
export async function guardedToolResult(guard: Guard, toolUseId: string, raw: string): Promise<ContentBlock> {
  const checked = await guard(raw, 'INPUT');
  return {
    toolResult: {
      toolUseId,
      status: checked.allowed ? 'success' : 'error',
      content: [{ text: checked.allowed ? checked.text : 'Result discarded: the safety check was triggered.' }],
    },
  };
}
