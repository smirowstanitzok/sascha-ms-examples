// test/rotate.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  SecretsManagerClient,
  DescribeSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  GetRandomPasswordCommand,
  UpdateSecretVersionStageCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-secrets-manager';
import { createRotationHandler } from '../src/rotate.js';
import type { LockApiSecret, LockPartnerClient } from '../src/lock-partner-client.js';

const SECRET_ID = 'bike-rental/lock-api';
const TOKEN = 'b7c1d2e3-0000-4000-8000-000000000001';
const base = { baseUrl: 'https://api.lockpartner.example', accountId: 'rental-42' };
const current: LockApiSecret = { ...base, keyId: 'start', apiKey: 'old-123' };
const pending: LockApiSecret = { ...base, keyId: 'rotation-b7c1d2e3', apiKey: 'new-456' };

const sm = mockClient(SecretsManagerClient);

// Fake partner: remembers which keys are valid.
class FakePartner implements LockPartnerClient {
  valid = new Set<string>(['old-123']);
  revoked: string[] = [];
  async ping(s: LockApiSecret) { return this.valid.has(s.apiKey); }
  async registerKey(_auth: LockApiSecret, k: LockApiSecret) { this.valid.add(k.apiKey); }
  async revokeKey(_auth: LockApiSecret, keyId: string) { this.revoked.push(keyId); }
}

function describeWith(stages: Record<string, string[]>) {
  sm.on(DescribeSecretCommand).resolves({ RotationEnabled: true, VersionIdsToStages: stages });
}

describe('Rotation of the lock API key', () => {
  let partner: FakePartner;
  beforeEach(() => {
    sm.reset();
    partner = new FakePartner();
  });

  it('createSecret stores a new AWSPENDING version', async () => {
    describeWith({ v1: ['AWSCURRENT'], [TOKEN]: ['AWSPENDING'] });
    sm.on(GetSecretValueCommand, { VersionStage: 'AWSCURRENT' }).resolves({ SecretString: JSON.stringify(current) });
    sm.on(GetSecretValueCommand, { VersionStage: 'AWSPENDING' }).rejects(
      new ResourceNotFoundException({ message: 'not found', $metadata: {} }),
    );
    sm.on(GetRandomPasswordCommand).resolves({ RandomPassword: 'new-456' });
    sm.on(PutSecretValueCommand).resolves({});

    await createRotationHandler(sm as unknown as SecretsManagerClient, partner)({
      SecretId: SECRET_ID, ClientRequestToken: TOKEN, Step: 'createSecret',
    });

    const put = sm.commandCalls(PutSecretValueCommand)[0].args[0].input;
    expect(put.VersionStages).toEqual(['AWSPENDING']);
    expect(JSON.parse(put.SecretString!)).toMatchObject({ keyId: 'rotation-b7c1d2e3', apiKey: 'new-456' });
  });

  it('setSecret revokes AWSPREVIOUS and registers the new key', async () => {
    describeWith({ v0: ['AWSPREVIOUS'], v1: ['AWSCURRENT'], [TOKEN]: ['AWSPENDING'] });
    sm.on(GetSecretValueCommand, { VersionStage: 'AWSCURRENT' }).resolves({ SecretString: JSON.stringify(current) });
    sm.on(GetSecretValueCommand, { VersionStage: 'AWSPENDING' }).resolves({ SecretString: JSON.stringify(pending) });
    sm.on(GetSecretValueCommand, { VersionStage: 'AWSPREVIOUS' }).resolves({
      SecretString: JSON.stringify({ ...base, keyId: 'very-old', apiKey: 'xyz' }),
    });

    await createRotationHandler(sm as unknown as SecretsManagerClient, partner)({
      SecretId: SECRET_ID, ClientRequestToken: TOKEN, Step: 'setSecret',
    });

    expect(partner.revoked).toEqual(['very-old']);
    expect(partner.valid.has('new-456')).toBe(true);
  });

  it('setSecret aborts when AWSPENDING points to another account', async () => {
    describeWith({ v1: ['AWSCURRENT'], [TOKEN]: ['AWSPENDING'] });
    sm.on(GetSecretValueCommand, { VersionStage: 'AWSCURRENT' }).resolves({ SecretString: JSON.stringify(current) });
    sm.on(GetSecretValueCommand, { VersionStage: 'AWSPENDING' }).resolves({
      SecretString: JSON.stringify({ ...pending, accountId: 'foreign-account' }),
    });

    await expect(
      createRotationHandler(sm as unknown as SecretsManagerClient, partner)({
        SecretId: SECRET_ID, ClientRequestToken: TOKEN, Step: 'setSecret',
      }),
    ).rejects.toThrow(/different targets/);
  });

  it('testSecret fails when the partner rejects the new key', async () => {
    describeWith({ v1: ['AWSCURRENT'], [TOKEN]: ['AWSPENDING'] });
    sm.on(GetSecretValueCommand, { VersionStage: 'AWSPENDING' }).resolves({ SecretString: JSON.stringify(pending) });

    await expect(
      createRotationHandler(sm as unknown as SecretsManagerClient, partner)({
        SecretId: SECRET_ID, ClientRequestToken: TOKEN, Step: 'testSecret',
      }),
    ).rejects.toThrow(/rejects the new key/);
  });

  it('finishSecret moves AWSCURRENT to the new version', async () => {
    describeWith({ v1: ['AWSCURRENT'], [TOKEN]: ['AWSPENDING'] });
    sm.on(UpdateSecretVersionStageCommand).resolves({});

    await createRotationHandler(sm as unknown as SecretsManagerClient, partner)({
      SecretId: SECRET_ID, ClientRequestToken: TOKEN, Step: 'finishSecret',
    });

    const input = sm.commandCalls(UpdateSecretVersionStageCommand)[0].args[0].input;
    expect(input).toMatchObject({ VersionStage: 'AWSCURRENT', MoveToVersionId: TOKEN, RemoveFromVersionId: 'v1' });
  });

  it('does nothing when the version is already AWSCURRENT (retry)', async () => {
    describeWith({ [TOKEN]: ['AWSCURRENT', 'AWSPENDING'] });

    await createRotationHandler(sm as unknown as SecretsManagerClient, partner)({
      SecretId: SECRET_ID, ClientRequestToken: TOKEN, Step: 'finishSecret',
    });

    expect(sm.commandCalls(UpdateSecretVersionStageCommand)).toHaveLength(0);
  });
});
