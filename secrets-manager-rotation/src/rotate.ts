// src/rotate.ts
// Rotation function for AWS Secrets Manager: rotates the API key
// for the lock API in the four steps createSecret, setSecret,
// testSecret and finishSecret.
import {
  SecretsManagerClient,
  DescribeSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  GetRandomPasswordCommand,
  UpdateSecretVersionStageCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-secrets-manager';
import { HttpLockPartnerClient, type LockApiSecret, type LockPartnerClient } from './lock-partner-client.js';

export interface RotationEvent {
  SecretId: string;
  ClientRequestToken: string;
  Step: 'createSecret' | 'setSecret' | 'testSecret' | 'finishSecret';
  RotationToken?: string; // pass it on, never log it
}

const CURRENT = 'AWSCURRENT';
const PENDING = 'AWSPENDING';
const PREVIOUS = 'AWSPREVIOUS';

export function createRotationHandler(sm: SecretsManagerClient, partner: LockPartnerClient) {
  async function readSecret(secretId: string, stage: string, versionId?: string): Promise<LockApiSecret> {
    const res = await sm.send(
      new GetSecretValueCommand({ SecretId: secretId, VersionStage: stage, VersionId: versionId }),
    );
    const value = JSON.parse(res.SecretString ?? '{}') as Partial<LockApiSecret>;
    for (const field of ['baseUrl', 'accountId', 'keyId', 'apiKey'] as const) {
      if (!value[field]) throw new Error(`Field ${field} missing in ${stage}`);
    }
    return value as LockApiSecret;
  }

  async function createSecret(secretId: string, token: string, rotationToken?: string): Promise<void> {
    const current = await readSecret(secretId, CURRENT);
    try {
      // If the version already exists (retry), there is nothing to do.
      await readSecret(secretId, PENDING, token);
      console.log('createSecret: AWSPENDING already exists');
      return;
    } catch (err) {
      if (!(err instanceof ResourceNotFoundException)) throw err;
    }
    const random = await sm.send(
      new GetRandomPasswordCommand({ PasswordLength: 48, ExcludePunctuation: true }),
    );
    const pending: LockApiSecret = {
      ...current,
      keyId: `rotation-${token.slice(0, 8)}`,
      apiKey: random.RandomPassword!,
    };
    await sm.send(
      new PutSecretValueCommand({
        SecretId: secretId,
        ClientRequestToken: token,
        SecretString: JSON.stringify(pending),
        VersionStages: [PENDING],
        RotationToken: rotationToken,
      }),
    );
    console.log(`createSecret: stored new version ${token} as AWSPENDING`);
  }

  async function setSecret(secretId: string, token: string, previousVersionId?: string): Promise<void> {
    const current = await readSecret(secretId, CURRENT);
    const pending = await readSecret(secretId, PENDING, token);

    // Confused deputy protection: both versions must belong to the same target.
    if (current.baseUrl !== pending.baseUrl || current.accountId !== pending.accountId) {
      throw new Error('setSecret: AWSCURRENT and AWSPENDING point to different targets');
    }
    // Only rotate if the current key still works.
    if (!(await partner.ping(current))) {
      throw new Error('setSecret: AWSCURRENT is invalid, rotation aborted');
    }

    // The partner allows two keys. We remove the one before last (AWSPREVIOUS)
    // now to make room for the new one. It has not been in use since the
    // last rotation.
    if (previousVersionId) {
      const previous = await readSecret(secretId, PREVIOUS, previousVersionId);
      if (previous.keyId !== current.keyId && previous.keyId !== pending.keyId) {
        await partner.revokeKey(current, previous.keyId);
        console.log(`setSecret: revoked old key ${previous.keyId}`);
      }
    }

    await partner.registerKey(current, pending);
    console.log(`setSecret: registered new key ${pending.keyId}`);
  }

  async function testSecret(secretId: string, token: string): Promise<void> {
    const pending = await readSecret(secretId, PENDING, token);
    if (!(await partner.ping(pending))) {
      throw new Error('testSecret: partner rejects the new key');
    }
    console.log('testSecret: new key works');
  }

  async function finishSecret(secretId: string, token: string, currentVersionId?: string): Promise<void> {
    if (currentVersionId === token) {
      console.log('finishSecret: version is already AWSCURRENT');
      return;
    }
    await sm.send(
      new UpdateSecretVersionStageCommand({
        SecretId: secretId,
        VersionStage: CURRENT,
        MoveToVersionId: token,
        RemoveFromVersionId: currentVersionId,
      }),
    );
    console.log(`finishSecret: AWSCURRENT now points to ${token}`);
  }

  return async function handler(event: RotationEvent): Promise<void> {
    const { SecretId: secretId, ClientRequestToken: token, Step: step } = event;
    // Important: never log the secret value, only step and version.
    console.log(`Rotation ${step} for version ${token}`);

    const meta = await sm.send(new DescribeSecretCommand({ SecretId: secretId }));
    if (!meta.RotationEnabled) throw new Error('Rotation is not enabled for this secret');

    const versions = meta.VersionIdsToStages ?? {};
    const stages = versions[token];
    if (!stages) throw new Error(`Version ${token} does not belong to this secret`);
    if (stages.includes(CURRENT)) {
      console.log('Version is already AWSCURRENT, nothing to do');
      return;
    }
    if (!stages.includes(PENDING)) throw new Error(`Version ${token} is not AWSPENDING`);

    const findVersion = (stage: string) =>
      Object.entries(versions).find(([, s]) => s.includes(stage))?.[0];

    switch (step) {
      case 'createSecret':
        return createSecret(secretId, token, event.RotationToken);
      case 'setSecret':
        return setSecret(secretId, token, findVersion(PREVIOUS));
      case 'testSecret':
        return testSecret(secretId, token);
      case 'finishSecret':
        return finishSecret(secretId, token, findVersion(CURRENT));
      default:
        throw new Error(`Unknown step: ${String(step)}`);
    }
  };
}

// Lambda entry point
export const handler = createRotationHandler(new SecretsManagerClient({}), new HttpLockPartnerClient());
