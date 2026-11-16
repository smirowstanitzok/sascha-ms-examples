// src/handlers/payment-worker.ts
import { createPartnerWorker, httpPartner } from '../partner-worker.ts';

export const handler = createPartnerWorker(
  httpPartner(process.env.PARTNER_URL ?? 'https://example.invalid', '/v1/captures'),
  { callTimeoutMs: Number(process.env.CALL_TIMEOUT_MS ?? 2500) },
);
