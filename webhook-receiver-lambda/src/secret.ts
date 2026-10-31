// src/secret.ts
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({});
let cached: { value: string; loadedAt: number } | undefined;
const MAX_AGE_MS = 5 * 60 * 1000; // reload after 5 minutes so a rotation takes effect

// Reads the webhook secret from Parameter Store and caches it briefly
export async function getWebhookSecret(): Promise<string> {
  if (cached && Date.now() - cached.loadedAt < MAX_AGE_MS) return cached.value;
  const result = await ssm.send(
    new GetParameterCommand({ Name: process.env.SECRET_PARAMETER_NAME, WithDecryption: true }),
  );
  const value = result.Parameter?.Value;
  if (!value) throw new Error('Webhook secret missing in Parameter Store');
  cached = { value, loadedAt: Date.now() };
  return value;
}
