// src/judge.ts
import Anthropic from '@anthropic-ai/sdk';
import type { Criterion, JudgeResult } from './types.ts';
import { buildJudgePrompt, parseJudgeOutput } from './prompt.ts';

export type Judge = (c: Criterion, question: string, answer: string) => Promise<JudgeResult>;

export function createClaudeJudge(model = process.env.JUDGE_MODEL ?? 'claude-sonnet-5-5'): Judge {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  return async (c, question, answer) => {
    const res = await client.messages.create({
      model,
      max_tokens: 400,
      messages: [{ role: 'user', content: buildJudgePrompt(c, question, answer) }],
    });
    const text = res.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');
    return parseJudgeOutput(text);
  };
}

// A deterministic mock judge so you can test the flow without an API key.
// It uses simple keyword rules – deliberately imperfect.
export function createMockJudge(): Judge {
  return async (c, _question, answer) => {
    const a = answer.toLowerCase();
    if (c.key === 'tone') {
      const rude = /(if you had read|your own fault|as i said|it clearly says)/.test(a);
      return { verdict: rude ? 'fail' : 'pass', reason: 'Keyword check' };
    }
    if (/discount|as an exception|extended for free/.test(a)) {
      return { verdict: 'fail', reason: 'Promises something outside the rules' };
    }
    if (a.length < 40) return { verdict: 'unknown', reason: 'Not enough content' };
    return { verdict: 'pass', reason: 'Nothing suspicious found' };
  };
}
