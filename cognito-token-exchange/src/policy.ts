// src/policy.ts
// Decides in the orders API what a call may do, depending on whether an agent is involved

export type Aktion = 'lesen' | 'stornieren';

export interface Entscheidung {
  erlaubt: boolean;
  grund: string;
  akteur?: string; // client ID of the agent from the act claim
}

export function entscheide(claims: Record<string, unknown>, aktion: Aktion): Entscheidung {
  const scopes = String(claims.scope ?? '').split(' ');
  const act = claims.act as { sub?: string } | undefined;
  const akteur = act?.sub;

  if (!scopes.includes(`bestellungen/${aktion}`)) {
    return { erlaubt: false, grund: `Scope bestellungen/${aktion} is missing`, akteur };
  }
  // An agent may never cancel, even if a scope slips through
  if (akteur && aktion === 'stornieren') {
    return { erlaubt: false, grund: 'Only the person themselves may cancel', akteur };
  }
  return { erlaubt: true, grund: akteur ? `on behalf via ${akteur}` : 'direct', akteur };
}
