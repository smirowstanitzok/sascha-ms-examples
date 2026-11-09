// scripts/send-test-webhook.ts
import { randomUUID } from 'node:crypto';
import { computeSignature } from '../src/signature.ts';

// Usage: WEBHOOK_URL=... WEBHOOK_SECRET=whsec_... npx tsx scripts/send-test-webhook.ts [id]
const url = process.env.WEBHOOK_URL;
const secret = process.env.WEBHOOK_SECRET;
if (!url || !secret) throw new Error('set WEBHOOK_URL and WEBHOOK_SECRET');

const id = process.argv[2] ?? `msg_${randomUUID()}`;
const timestamp = String(Math.floor(Date.now() / 1000));
const body = JSON.stringify({ type: 'payment.succeeded', data: { rentalId: 'R-1042', amountCents: 1890 } });

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'webhook-id': id,
    'webhook-timestamp': timestamp,
    'webhook-signature': `v1,${computeSignature(secret, id, timestamp, body)}`,
  },
  body,
});
console.log(id, response.status, await response.text());
