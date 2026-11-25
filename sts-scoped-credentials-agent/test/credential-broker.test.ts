// test/credential-broker.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GetScopedCredentialsCommand } from '@aws-sdk/client-sts';
import { ScopedCredentialBroker, type StsSender } from '../src/credential-broker.ts';
import { readOnlyPolicy } from '../src/scope-policy.ts';

function fakeSts(minutesValid: number, failFirstWith?: string) {
  const calls: GetScopedCredentialsCommand[] = [];
  const sts: StsSender = {
    async send(command) {
      calls.push(command);
      if (failFirstWith && calls.length === 1) {
        throw Object.assign(new Error('nope'), { name: failFirstWith });
      }
      return {
        $metadata: {},
        Credentials: {
          AccessKeyId: 'ASIAEXAMPLE',
          SecretAccessKey: 'secret',
          SessionToken: 'token',
          Expiration: new Date(Date.now() + minutesValid * 60_000),
        },
      };
    },
  };
  return { sts, calls };
}

const request = {
  policy: readOnlyPolicy('pedalwerk-docs', 'velo-kiel'),
  durationSeconds: 900,
  description: 'summarizer shop=velo-kiel',
};

test('same request uses the cache', async () => {
  const { sts, calls } = fakeSts(15);
  const broker = new ScopedCredentialBroker(sts);
  await broker.scope(request);
  await broker.scope(request);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input.ScopedSessionDescription, 'summarizer shop=velo-kiel');
});

test('fresh credentials are fetched shortly before expiry', async () => {
  const { sts, calls } = fakeSts(0.5); // 30 seconds remaining
  const broker = new ScopedCredentialBroker(sts, 60_000);
  await broker.scope(request);
  await broker.scope(request);
  assert.equal(calls.length, 2);
});

test('session too short: second attempt without DurationSeconds', async () => {
  const { sts, calls } = fakeSts(15, 'InsufficientSessionLifetimeException');
  const broker = new ScopedCredentialBroker(sts);
  const creds = await broker.scope(request);
  assert.equal(creds.accessKeyId, 'ASIAEXAMPLE');
  assert.equal(calls[0].input.DurationSeconds, 900);
  assert.equal(calls[1].input.DurationSeconds, undefined);
});

test('other errors are passed through', async () => {
  const { sts } = fakeSts(15, 'MalformedPolicyDocumentException');
  const broker = new ScopedCredentialBroker(sts);
  await assert.rejects(broker.scope(request), { name: 'MalformedPolicyDocumentException' });
});
