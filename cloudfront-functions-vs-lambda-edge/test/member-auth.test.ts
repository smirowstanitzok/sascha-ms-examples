// test/member-auth.test.ts – tests the Lambda@Edge function with a locally signed token
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import type { CloudFrontHeaders, CloudFrontRequestEvent, CloudFrontRequest } from 'aws-lambda';

process.env.USER_POOL_ID = 'eu-central-1_Speichen1';
process.env.USER_POOL_CLIENT_ID = 'speichenwerk-web';
const { handler, verifier } = await import('../edge/member-auth.js');

// Local key pair instead of Cognito: we load the public key into the verifier cache
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
verifier.cacheJwks({ keys: [jwk as any] });

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
function signToken(claims: Record<string, unknown>): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64({ alg: 'RS256', kid: 'test-key', typ: 'JWT' });
  const payload = b64({
    iss: `https://cognito-idp.eu-central-1.amazonaws.com/${process.env.USER_POOL_ID}`,
    aud: process.env.USER_POOL_CLIENT_ID,
    token_use: 'id',
    sub: 'member-42',
    iat: now,
    exp: now + 3600,
    ...claims
  });
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey, 'base64url');
  return `${header}.${payload}.${signature}`;
}

function event(uri: string, cookie?: string): CloudFrontRequestEvent {
  const headers: CloudFrontHeaders = cookie ? { cookie: [{ key: 'Cookie', value: cookie }] } : {};
  return {
    Records: [{ cf: { config: {} as any, request: { uri, method: 'GET', querystring: '', clientIp: '203.0.113.10', headers } } }]
  };
}

test('without a cookie the user is sent to the login page', async () => {
  const result: any = await handler(event('/mitglieder/touren/'));
  assert.equal(result.status, '302');
  assert.equal(result.headers.location[0].value, '/anmelden/?next=%2Fmitglieder%2Ftouren%2F');
});

test('valid token passes and gets index.html', async () => {
  const token = signToken({});
  const result = (await handler(event('/mitglieder/', `theme=dark; id_token=${token}`))) as CloudFrontRequest;
  assert.equal(result.uri, '/mitglieder/index.html');
});

test('expired token leads to the login page', async () => {
  const token = signToken({ exp: Math.floor(Date.now() / 1000) - 60 });
  const result: any = await handler(event('/mitglieder/', `id_token=${token}`));
  assert.equal(result.status, '302');
});

test('token from another app client is rejected', async () => {
  const token = signToken({ aud: 'other-client' });
  const result: any = await handler(event('/mitglieder/', `id_token=${token}`));
  assert.equal(result.status, '302');
});
