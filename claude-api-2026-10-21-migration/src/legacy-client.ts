// src/legacy-client.ts
import Anthropic from '@anthropic-ai/sdk';

// Transition: new SDK, old API version
export const legacyClient = new Anthropic({
  defaultHeaders: { 'anthropic-version': '2023-06-01' },
});
