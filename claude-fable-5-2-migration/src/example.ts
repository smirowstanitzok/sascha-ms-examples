// src/example.ts
// Example: migration plan for a fictional bike rental backend with Claude Fable 5.2
import Anthropic from '@anthropic-ai/sdk';
import { askClaude } from './ask-claude.ts';
import { PROFILES } from './models.ts';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const result = await askClaude(
  client,
  'Plan the migration of our bike rental backend from Express 4 to Fastify 5. ' +
    'Return a numbered list of risks and test steps.',
  {
    profile: PROFILES.heavy,
    system: 'You are an experienced Node.js architect. Answer briefly.',
    onRefusal: (r) => console.warn(`Declined by ${r.model} (category: ${r.category ?? 'none'})`),
  },
);

console.log(`Served by: ${result.servedBy}`);
console.log(result.text);
