// src/judge.ts
import Anthropic from '@anthropic-ai/sdk';
import type { RawVerdict } from './types.ts';
import { buildPairPrompt, parsePairVerdict } from './prompt.ts';

export type PairJudge = (question: string, answerA: string, answerB: string) => Promise<RawVerdict>;

export function createClaudePairJudge(model = process.env.JUDGE_MODEL ?? 'claude-sonnet-5-5'): PairJudge {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  return async (question, answerA, answerB) => {
    const res = await client.messages.create({
      model,
      max_tokens: 400,
      messages: [{ role: 'user', content: buildPairPrompt(question, answerA, answerB) }],
    });
    const text = res.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');
    return parsePairVerdict(text);
  };
}

// Mock judge for runs without an API key. It has a deliberate position bias:
// if both answers are close, the first one simply wins.
export function createBiasedMockJudge(): PairJudge {
  const score = (answer: string): number => {
    const a = answer.toLowerCase();
    let points = 0;
    if (/(€|\$)\s?\d+|\d+\s?(euros?|€)/.test(a)) points += 2; // names a concrete price
    if (/(\bid\b|deposit|helmet)/.test(a)) points += 1;       // names a condition
    if (/(for free|free of charge|as an exception)/.test(a)) points -= 3; // promise outside the rules
    return points;
  };
  return async (_question, answerA, answerB) => {
    const diff = score(answerA) - score(answerB);
    if (diff >= 2) return 'A';
    if (diff <= -2) return 'B';
    return 'A'; // the built-in bias
  };
}
