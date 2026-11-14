// src/booking-handler.ts
import {
  GetSecretValueCommand,
  ResourceNotFoundException,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({});
const secretArn = process.env.PAYMENT_SECRET_ARN ?? '';
const cacheMs = Number(process.env.SECRET_CACHE_SECONDS ?? '300') * 1000;

let cached: { value: string; versionId: string; loadedAt: number } | undefined;

// Reads the replica from its own account and keeps it in memory for a short time
export async function getPaymentApiKey(now = Date.now()) {
  if (cached && now - cached.loadedAt < cacheMs) {
    return cached;
  }
  try {
    const result = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
    cached = {
      value: result.SecretString ?? '',
      versionId: result.VersionId ?? 'unknown',
      loadedAt: now,
    };
    return cached;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      // Typical right after creation: the replica has no value yet
      throw new Error('Replica not synchronized yet - check the status in the primary account');
    }
    throw error;
  }
}

export const handler = async () => {
  const apiKey = await getPaymentApiKey();
  // Never log the value, only metadata
  console.log(JSON.stringify({ message: 'API key loaded', versionId: apiKey.versionId }));
  return {
    statusCode: 200,
    body: JSON.stringify({ keyLoaded: apiKey.value.length > 0, versionId: apiKey.versionId }),
  };
};
