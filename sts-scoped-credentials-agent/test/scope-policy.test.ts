// test/scope-policy.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  denyListPolicy,
  MAX_POLICY_CHARS,
  serializePolicy,
  shopToolPolicy,
} from '../src/scope-policy.ts';

test('policy only contains the prefix of the own shop', () => {
  const json = serializePolicy(shopToolPolicy('pedalwerk-docs', 'velo-kiel'));
  assert.match(json, /shops\/velo-kiel\/docs\/\*/);
  assert.doesNotMatch(json, /shops\/\*/);
  assert.doesNotMatch(json, /sts:GetScopedCredentials/);
});

test('shop IDs with wildcards or slashes are rejected', () => {
  for (const bad of ['*', 'velo/kiel', '../admin', 'a', 'VELO']) {
    assert.throws(() => shopToolPolicy('pedalwerk-docs', bad), /Invalid shop ID/);
  }
});

test('further scoping must be allowed explicitly', () => {
  const json = serializePolicy(shopToolPolicy('pedalwerk-docs', 'velo-kiel', true));
  assert.match(json, /sts:GetScopedCredentials/);
});

test('oversized policies fail before the STS call', () => {
  const many = Array.from({ length: 200 }, (_, i) => `service${i}:DeleteEverything`);
  assert.throws(() => serializePolicy(denyListPolicy(many)), /the limit is 2048/);
  assert.ok(serializePolicy(denyListPolicy()).length < MAX_POLICY_CHARS);
});
