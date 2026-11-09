// src/approvals.ts
export type Stage = 'team' | 'lead';

export interface CreditRequest {
  orderId: string;
  amountCents: number;
  reason: string;
  requestedBy: string;
}

export interface ApprovalTask {
  taskToken: string;
  stage: Stage;
  executionId: string;
  request: CreditRequest;
}

export interface Decision {
  approvalId: string;
  decision: 'approved' | 'rejected';
  comment?: string;
}

// How long an entry is kept for auditing after the deadline
export const KEEP_SECONDS = 7 * 24 * 60 * 60;

export function parseDecision(body: string | undefined): Decision {
  if (!body) throw new Error('Body is missing');
  const data = JSON.parse(body) as Partial<Decision>;
  if (typeof data.approvalId !== 'string' || !/^[0-9a-f-]{36}$/.test(data.approvalId)) {
    throw new Error('approvalId is missing or invalid');
  }
  if (data.decision !== 'approved' && data.decision !== 'rejected') {
    throw new Error('decision must be "approved" or "rejected"');
  }
  const comment = typeof data.comment === 'string' ? data.comment.slice(0, 500) : undefined;
  return { approvalId: data.approvalId, decision: data.decision, comment };
}

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
