// src/private-key.ts
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});
let cached: { value: string; loadedAt: number } | undefined;
const TTL_MS = 5 * 60 * 1000; // reload after 5 minutes so key rotation takes effect

export async function loadPrivateKey(parameterName: string): Promise<string> {
  if (cached && Date.now() - cached.loadedAt < TTL_MS) return cached.value;
  const res = await ssm.send(
    new GetParameterCommand({ Name: parameterName, WithDecryption: true }),
  );
  const value = res.Parameter?.Value;
  if (!value) throw new Error(`Parameter ${parameterName} is empty`);
  cached = { value, loadedAt: Date.now() };
  return value;
}
