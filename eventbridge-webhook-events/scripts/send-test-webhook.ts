// scripts/send-test-webhook.ts
// Plays the payment provider: sends a signed event to the webhook URL
import { randomUUID } from 'node:crypto';
import { signWebhook } from '../src/standard-webhooks.ts';

const url = process.env.WEBHOOK_URL;
const secret = process.env.WEBHOOK_SECRET;
if (!url || !secret) {
  console.error('Please set WEBHOOK_URL and WEBHOOK_SECRET.');
  process.exit(1);
}

const type = process.argv[2] === 'refund' ? 'payment.refunded' : 'payment.succeeded';
const body = JSON.stringify({
  id: `evt_${randomUUID()}`,
  type,
  createdAt: new Date().toISOString(),
  data: { paymentId: 'pay_77', bookingId: 'B-1042', amountCents: 1250, currency: 'EUR' },
});

// Send the same message twice: this is how you test provider retries
const messageId = `msg_${randomUUID()}`;
for (const attempt of [1, 2]) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...signWebhook(secret, messageId, body) },
    body,
  });
  console.log(`Attempt ${attempt}: HTTP ${response.status}`);
}
