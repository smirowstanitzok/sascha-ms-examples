// src/prompt.ts
import type { RawVerdict } from './types.ts';

export function buildPairPrompt(question: string, answerA: string, answerB: string): string {
  return [
    'You are rating two answers from a customer service assistant for a bike rental shop.',
    'Criteria: factually correct, answers the question completely, friendly, no promises outside the rules.',
    'The order of the answers is random and says nothing about their quality.',
    'Length is not a quality signal: a short, correct answer beats a long one with mistakes.',
    '',
    `<question>${question}</question>`,
    `<answer_a>${answerA}</answer_a>`,
    `<answer_b>${answerB}</answer_b>`,
    '',
    'Explain your verdict in at most three sentences.',
    'Then write exactly one line: <verdict>A</verdict>, <verdict>B</verdict> or <verdict>TIE</verdict>.',
  ].join('\n');
}

export function parsePairVerdict(text: string): RawVerdict {
  const match = text.match(/<verdict>\s*(A|B|TIE)\s*<\/verdict>/i);
  if (!match) return 'UNKNOWN';
  return match[1].toUpperCase() as RawVerdict;
}
