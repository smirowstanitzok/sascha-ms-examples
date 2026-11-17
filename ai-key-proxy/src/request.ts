// src/request.ts
/** The server sets the limits, never the client. */
export const MAX_CHARS = 2000;
export const MAX_ANSWER_TOKENS = 500;

export type CheckResult = { ok: true; question: string } | { ok: false; reason: string };

/** Validates the request body. The client cannot choose the model, system prompt or token limit. */
export function checkRequest(body: string | undefined): CheckResult {
  if (!body) return { ok: false, reason: 'Empty body' };
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return { ok: false, reason: 'Invalid JSON' };
  }
  const question = (data as { question?: unknown }).question;
  if (typeof question !== 'string' || question.trim().length === 0) {
    return { ok: false, reason: 'Field "question" is missing' };
  }
  if (question.length > MAX_CHARS) {
    return { ok: false, reason: `Question longer than ${MAX_CHARS} characters` };
  }
  const forbidden = Object.keys(data as object).filter((k) => k !== 'question');
  if (forbidden.length > 0) {
    return { ok: false, reason: `Forbidden fields: ${forbidden.join(', ')}` };
  }
  return { ok: true, question: question.trim() };
}

/** Rough estimate: about 4 characters per token, plus the maximum answer length. */
export function estimateTokens(question: string): number {
  return Math.ceil(question.length / 4) + 200 + MAX_ANSWER_TOKENS;
}
