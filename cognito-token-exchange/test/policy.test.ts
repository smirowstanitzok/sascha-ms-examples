// test/policy.test.ts
import { describe, expect, it } from 'vitest';
import { entscheide } from '../src/policy.js';

describe('entscheide', () => {
  it('lets the agent read and records the actor', () => {
    const e = entscheide({ sub: 'u1', scope: 'bestellungen/lesen', act: { sub: 'agent-1' } }, 'lesen');
    expect(e).toEqual({ erlaubt: true, grund: 'on behalf via agent-1', akteur: 'agent-1' });
  });

  it('does not let the agent cancel, even with the scope', () => {
    const e = entscheide({ scope: 'bestellungen/lesen bestellungen/stornieren', act: { sub: 'agent-1' } }, 'stornieren');
    expect(e.erlaubt).toBe(false);
  });

  it('lets the person cancel themselves', () => {
    expect(entscheide({ scope: 'bestellungen/stornieren' }, 'stornieren').erlaubt).toBe(true);
  });

  it('denies when the scope is missing', () => {
    expect(entscheide({ scope: 'buchladen-agent/chat' }, 'lesen').grund).toMatch(/Scope/);
  });
});
