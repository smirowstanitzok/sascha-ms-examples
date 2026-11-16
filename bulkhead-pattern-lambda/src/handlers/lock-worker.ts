// src/handlers/lock-worker.ts
import { createPartnerWorker, httpPartner } from '../partner-worker.ts';

export const handler = createPartnerWorker(
  httpPartner(process.env.PARTNER_URL ?? 'https://example.invalid', '/v1/unlock-codes'),
  { callTimeoutMs: Number(process.env.CALL_TIMEOUT_MS ?? 2500) },
);
