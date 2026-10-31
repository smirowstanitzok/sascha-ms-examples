// test/state-machine.test.ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import jsonata from 'jsonata';

const asl = JSON.parse(readFileSync('statemachine/credit-approval.asl.json', 'utf8'));

// Evaluates the CheckAmount choice rules the way Step Functions does
async function route(amountCents: number): Promise<string> {
  const state = asl.States.CheckAmount;
  for (const rule of state.Choices) {
    const expr = rule.Condition.replace(/^\{%|%\}$/g, '');
    if (await jsonata(expr).evaluate({}, { request: { amountCents } })) return rule.Next;
  }
  return state.Default;
}

describe('CheckAmount', () => {
  it('applies small amounts without approval', async () => {
    expect(await route(2000)).toBe('ApplyCredit');
  });
  it('asks a human from 20.01 euros', async () => {
    expect(await route(2001)).toBe('AskTeam');
    expect(await route(50000)).toBe('AskTeam');
  });
  it('blocks everything above the agent limit', async () => {
    expect(await route(50001)).toBe('AboveAgentLimit');
  });
});
