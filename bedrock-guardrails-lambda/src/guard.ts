// src/guard.ts
import {
  ApplyGuardrailCommand,
  type ApplyGuardrailCommandOutput,
  type GuardrailAssessment,
} from '@aws-sdk/client-bedrock-runtime';

export type GuardSource = 'INPUT' | 'OUTPUT';

export interface GuardResult {
  /** false = the guardrail blocked, the text must not go any further */
  allowed: boolean;
  /** original text, masked text or the configured blocked message */
  text: string;
  /** short findings without the matched values, e.g. "pii:EMAIL:ANONYMIZED" */
  findings: string[];
}

export type SendApplyGuardrail = (
  command: ApplyGuardrailCommand,
) => Promise<ApplyGuardrailCommandOutput>;

// Collects every intervention of an assessment. The matched values (match)
// are deliberately left out so that no customer data ends up in the logs.
export function describeFindings(assessments: GuardrailAssessment[] = []): string[] {
  const findings: string[] = [];
  for (const a of assessments) {
    for (const t of a.topicPolicy?.topics ?? []) {
      if (t.action && t.action !== 'NONE') findings.push(`topic:${t.name}:${t.action}`);
    }
    for (const f of a.contentPolicy?.filters ?? []) {
      if (f.action && f.action !== 'NONE') findings.push(`content:${f.type}:${f.action}`);
    }
    for (const w of a.wordPolicy?.customWords ?? []) {
      if (w.action && w.action !== 'NONE') findings.push(`word:custom:${w.action}`);
    }
    for (const w of a.wordPolicy?.managedWordLists ?? []) {
      if (w.action && w.action !== 'NONE') findings.push(`word:${w.type}:${w.action}`);
    }
    for (const p of a.sensitiveInformationPolicy?.piiEntities ?? []) {
      if (p.action && p.action !== 'NONE') findings.push(`pii:${p.type}:${p.action}`);
    }
    for (const r of a.sensitiveInformationPolicy?.regexes ?? []) {
      if (r.action && r.action !== 'NONE') findings.push(`regex:${r.name}:${r.action}`);
    }
  }
  return findings;
}

export function toGuardResult(original: string, out: ApplyGuardrailCommandOutput): GuardResult {
  if (out.action !== 'GUARDRAIL_INTERVENED') {
    return { allowed: true, text: original, findings: [] };
  }
  const findings = describeFindings(out.assessments);
  const text = (out.outputs ?? []).map((o) => o.text ?? '').join('');
  const blocked = findings.length === 0 || findings.some((f) => f.endsWith(':BLOCKED'));
  if (blocked) {
    return { allowed: false, text: text || 'Sorry, I cannot handle this request.', findings };
  }
  // Masked only: the text may continue, but in its masked form.
  return { allowed: true, text: text || original, findings };
}

export function createGuard(send: SendApplyGuardrail, guardrailId: string, guardrailVersion: string) {
  return async (text: string, source: GuardSource): Promise<GuardResult> => {
    const out = await send(
      new ApplyGuardrailCommand({
        guardrailIdentifier: guardrailId,
        guardrailVersion,
        source,
        content: [{ text: { text } }],
      }),
    );
    return toGuardResult(text, out);
  };
}
