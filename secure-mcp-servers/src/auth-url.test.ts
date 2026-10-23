import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAuthorizationUrl, UnsafeAuthorizationUrlError, validateAuthorizationEndpoint } from './auth-url.js';

const policy = { allowedHosts: ['auth.example.com'] };

test('normal endpoint is accepted', () => {
  const url = validateAuthorizationEndpoint('https://auth.example.com/oauth2/authorize', policy);
  assert.equal(url.hostname, 'auth.example.com');
});

test('PowerShell subexpression in the path is rejected', () => {
  assert.throws(
    () => validateAuthorizationEndpoint('https://auth.example.com/$(calc.exe)', policy),
    UnsafeAuthorizationUrlError,
  );
});

test('foreign host is rejected, even if the URL looks harmless', () => {
  assert.throws(
    () => validateAuthorizationEndpoint('https://login.evil.example/authorize', policy),
    /allowlist/,
  );
});

test('javascript: and http without localhost are rejected', () => {
  assert.throws(() => validateAuthorizationEndpoint('javascript:alert(1)', policy), UnsafeAuthorizationUrlError);
  assert.throws(() => validateAuthorizationEndpoint('http://auth.example.com/authorize', policy), /Scheme/);
});

test('localhost via http only with explicit permission', () => {
  assert.throws(() => validateAuthorizationEndpoint('http://localhost:8080/authorize', policy), /Scheme/);
  const url = validateAuthorizationEndpoint('http://localhost:8080/authorize', { ...policy, allowLoopbackHttp: true });
  assert.equal(url.port, '8080');
});

test('parameters are fully encoded', () => {
  const endpoint = validateAuthorizationEndpoint('https://auth.example.com/authorize', policy);
  const href = buildAuthorizationUrl(endpoint, { state: '$(whoami)', scope: 'tools:read tools:execute' });
  assert.ok(!href.includes('$('));
  assert.ok(href.includes('state=%24%28whoami%29'));
});
