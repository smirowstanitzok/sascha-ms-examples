// src/standard-webhooks.ts
import { createHmac } from 'node:crypto';

// Standard Webhooks: the secret often comes with a "whsec_" prefix and is base64-encoded
export const signingKey = (secret: string): Buffer =>
  Buffer.from(secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret, 'base64');

export interface SignedHeaders {
  'webhook-id': string;
  'webhook-timestamp': string;
  'webhook-signature': string;
}

// Signs "<id>.<timestamp>.<body>" with HMAC-SHA256, the way EventBridge verifies it
export const signWebhook = (
  secret: string,
  messageId: string,
  body: string,
  timestampSeconds: number = Math.floor(Date.now() / 1000),
): SignedHeaders => {
  const timestamp = String(timestampSeconds);
  const signature = createHmac('sha256', signingKey(secret))
    .update(`${messageId}.${timestamp}.${body}`)
    .digest('base64');
  return {
    'webhook-id': messageId,
    'webhook-timestamp': timestamp,
    'webhook-signature': `v1,${signature}`,
  };
};
