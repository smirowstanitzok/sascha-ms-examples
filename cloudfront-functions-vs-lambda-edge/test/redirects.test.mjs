// test/redirects.test.mjs – tests the CloudFront Function locally with a fake KeyValueStore
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const store = new Map([['/preise.html', '/preise/']]);
globalThis.fakeKvs = {
  exists: async (key) => store.has(key),
  get: async (key) => {
    if (!store.has(key)) throw new Error('Key not found');
    return store.get(key);
  }
};

// Replace the 'cloudfront' import with the fake and export the handler
const source = await readFile(new URL('../functions/redirects.js', import.meta.url), 'utf8');
const patched = source
  .replace("import cf from 'cloudfront';", 'const cf = { kvs: () => globalThis.fakeKvs };')
  .concat('\nexport { handler };\n');
const dir = await mkdtemp(join(tmpdir(), 'cff-'));
const file = join(dir, 'redirects.mjs');
await writeFile(file, patched);
const { handler } = await import(pathToFileURL(file).href);

const event = (uri) => ({ request: { uri, method: 'GET', headers: {}, querystring: {}, cookies: {} } });

test('old URL gets a 301 redirect', async () => {
  const result = await handler(event('/preise.html'));
  assert.equal(result.statusCode, 301);
  assert.equal(result.headers.location.value, '/preise/');
});

test('folder with trailing slash gets index.html', async () => {
  const result = await handler(event('/touren/'));
  assert.equal(result.uri, '/touren/index.html');
});

test('folder without trailing slash gets /index.html', async () => {
  const result = await handler(event('/touren'));
  assert.equal(result.uri, '/touren/index.html');
});

test('files stay unchanged', async () => {
  const result = await handler(event('/bilder/rad.webp'));
  assert.equal(result.uri, '/bilder/rad.webp');
});
