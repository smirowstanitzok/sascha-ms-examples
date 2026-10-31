// src/apply-credit.ts
import { createHash } from 'node:crypto';
import type { CreditRequest } from './approvals.js';

interface ApplyCreditEvent {
  request: CreditRequest;
  approval: { decision: string; decidedBy: string; comment?: string };
}

export const handler = async (event: ApplyCreditEvent) => {
  // Placeholder for your accounting system. The key makes retries idempotent.
  const creditId = createHash('sha256')
    .update(`${event.request.orderId}:${event.request.amountCents}`)
    .digest('hex')
    .slice(0, 16);

  console.log(JSON.stringify({ msg: 'Credit applied', creditId, ...event }));
  return { status: 'credited', creditId, orderId: event.request.orderId, approvedBy: event.approval.decidedBy };
};
