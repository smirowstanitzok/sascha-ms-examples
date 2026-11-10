// src/migration-check.ts
// Checks request parameters before sending for anything Claude Fable 5.2 rejects with a 400.
export interface RequestLike {
  model: string;
  max_tokens: number;
  messages: Array<{ role: string }>;
  temperature?: number | null;
  top_p?: number | null;
  top_k?: number | null;
  tool_choice?: { type: string } | null;
  thinking?: { type: string } | null;
}

export interface Finding {
  level: 'error' | 'warning';
  message: string;
}

const STRICT_MODELS = /^(anthropic\.)?claude-(fable|mythos)-5-2/;

export function checkForFable(req: RequestLike): Finding[] {
  if (!STRICT_MODELS.test(req.model)) return [];
  const findings: Finding[] = [];

  for (const key of ['temperature', 'top_p', 'top_k'] as const) {
    if (req[key] != null) {
      findings.push({ level: 'error', message: `remove ${key} – omit sampling parameters` });
    }
  }

  const choice = req.tool_choice?.type;
  if (choice === 'any' || choice === 'tool') {
    findings.push({
      level: 'error',
      message: `tool_choice "${choice}" is rejected – use "auto" and name the tool in the prompt`,
    });
  }

  if (req.thinking && req.thinking.type !== 'adaptive') {
    findings.push({
      level: 'error',
      message: `remove thinking.type "${req.thinking.type}" – thinking is always adaptive`,
    });
  }

  if (req.messages.at(-1)?.role === 'assistant') {
    findings.push({ level: 'error', message: 'remove prefill (last message from the assistant)' });
  }

  if (req.max_tokens < 16_000) {
    findings.push({
      level: 'warning',
      message: `max_tokens ${req.max_tokens} is tight – thinking tokens count too`,
    });
  }

  return findings;
}
