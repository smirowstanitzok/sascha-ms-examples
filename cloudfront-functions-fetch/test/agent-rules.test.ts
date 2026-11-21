// test/agent-rules.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { denialReason, scopeFromPath, statusFor, usageKey, type AgentRecord } from '../src/agent-rules.ts';

const agent = (overrides: Partial<AgentRecord> = {}): AgentRecord => ({
  tokenHash: 'abc',
  agentId: 'agent-bike-planner',
  status: 'active',
  scopes: new Set(['bikes']),
  dailyBudget: 2,
  ...overrides,
});

test('scope comes from the first path segment', () => {
  assert.equal(scopeFromPath('/bikes/42?x=1'), 'bikes');
  assert.equal(scopeFromPath('/'), 'root');
});

test('counter key contains the date', () => {
  assert.equal(usageKey(new Date('2026-11-21T10:00:00Z')), 'used_2026-11-21');
});

test('denial reasons are detected correctly', () => {
  const key = 'used_2026-11-21';
  assert.equal(denialReason(undefined, 'bikes', key), 'unknown_agent');
  assert.equal(denialReason(agent({ status: 'revoked' }), 'bikes', key), 'revoked');
  assert.equal(denialReason(agent(), 'stations', key), 'scope');
  assert.equal(denialReason(agent({ [key]: 2 }), 'bikes', key), 'budget');
});

test('budget leads to 429, everything else to 403', () => {
  assert.equal(statusFor('budget'), 429);
  assert.equal(statusFor('scope'), 403);
});
