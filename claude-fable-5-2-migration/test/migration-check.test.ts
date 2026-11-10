// test/migration-check.test.ts
import { describe, expect, it } from 'vitest';
import { checkForFable } from '../src/migration-check.ts';

const base = { max_tokens: 64_000, messages: [{ role: 'user' }] };

describe('checkForFable', () => {
  it('reports old parameters that Fable 5.2 rejects with a 400', () => {
    const findings = checkForFable({
      ...base,
      model: 'claude-fable-5-2',
      temperature: 0.2,
      tool_choice: { type: 'any' },
      thinking: { type: 'disabled' },
    });
    const errors = findings.filter((f) => f.level === 'error').map((f) => f.message);
    expect(errors).toHaveLength(3);
    expect(errors.join(' ')).toMatch(/temperature/);
    expect(errors.join(' ')).toMatch(/tool_choice "any"/);
    expect(errors.join(' ')).toMatch(/thinking\.type "disabled"/);
  });

  it('detects prefill and a tight max_tokens', () => {
    const findings = checkForFable({
      model: 'anthropic.claude-fable-5-2',
      max_tokens: 4_000,
      messages: [{ role: 'user' }, { role: 'assistant' }],
    });
    expect(findings.map((f) => f.level)).toEqual(['error', 'warning']);
  });

  it('leaves other models alone', () => {
    expect(checkForFable({ ...base, model: 'claude-opus-5-5', temperature: 0.2 })).toEqual([]);
  });

  it('accepts a clean request', () => {
    expect(checkForFable({ ...base, model: 'claude-fable-5-2', tool_choice: { type: 'auto' } })).toEqual([]);
  });
});
