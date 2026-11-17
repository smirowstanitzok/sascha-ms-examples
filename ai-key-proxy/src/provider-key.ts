// src/provider-key.ts
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({});
let cache: { value: string; loadedAt: number } | undefined;
const VALID_MS = 5 * 60 * 1000;

/**
 * Loads an external provider key (e.g. for the Anthropic or OpenAI API)
 * as a SecureString from Parameter Store. The key never lives in code,
 * environment variables or bundles and is reloaded at most 5 minutes after a rotation.
 */
export async function providerKey(parameterName: string): Promise<string> {
  if (cache && Date.now() - cache.loadedAt < VALID_MS) {
    return cache.value;
  }
  const response = await ssm.send(new GetParameterCommand({ Name: parameterName, WithDecryption: true }));
  const value = response.Parameter?.Value;
  if (!value) throw new Error(`Parameter ${parameterName} is empty`);
  cache = { value, loadedAt: Date.now() };
  return value;
}
