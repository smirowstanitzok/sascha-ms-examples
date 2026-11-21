// src/agent-rules.ts
// Pure logic without AWS calls, so it can be tested with node:test.

export interface AgentRecord {
  tokenHash: string;
  agentId: string;
  status: 'active' | 'revoked';
  scopes: Set<string> | string[];
  dailyBudget: number;
  [usageKey: string]: unknown;
}

export type Denial = 'unknown_agent' | 'revoked' | 'scope' | 'budget';

// "/bikes/42" -> "bikes", "/" -> "root"
export function scopeFromPath(path: string): string {
  const first = path.split('?')[0].split('/').filter(Boolean)[0];
  return first ? first.toLowerCase() : 'root';
}

// One counter per day, e.g. "used_2026-11-21"
export function usageKey(now: Date): string {
  return `used_${now.toISOString().slice(0, 10)}`;
}

// Why did DynamoDB reject the condition? We get the old item back.
export function denialReason(item: AgentRecord | undefined, scope: string, key: string): Denial {
  if (!item) return 'unknown_agent';
  if (item.status !== 'active') return 'revoked';
  const scopes = item.scopes instanceof Set ? item.scopes : new Set(item.scopes);
  if (!scopes.has(scope)) return 'scope';
  const used = Number(item[key] ?? 0);
  if (used >= item.dailyBudget) return 'budget';
  return 'unknown_agent';
}

export function statusFor(reason: Denial): number {
  return reason === 'budget' ? 429 : 403;
}
