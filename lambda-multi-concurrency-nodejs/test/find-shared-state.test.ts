// test/find-shared-state.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../scripts/find-shared-state.js';

const kinds = (code: string) => analyze('example.ts', code).map((f) => f.kind);

test('reports mutable module variables and writes', () => {
  const code = `let user; export const handler = async (e) => { user = e.user; return user; };`;
  assert.deepEqual(kinds(code), ['module-variable', 'write']);
});

test('reports changes to module objects via methods', () => {
  const code = `const seen = new Set(); export const handler = async (e) => { seen.add(e.id); };`;
  assert.deepEqual(kinds(code), ['write']);
});

test('reports fixed file names in /tmp, process.on and _X_AMZN_TRACE_ID', () => {
  const code = `
    import { join } from 'node:path'; import { tmpdir } from 'node:os';
    const a = '/tmp/export.csv';
    const b = join(tmpdir(), 'receipt.txt');
    const c = join(tmpdir(), \`receipt-\${Date.now()}.txt\`);
    process.on('SIGTERM', () => {});
    const t = process.env._X_AMZN_TRACE_ID;`;
  assert.deepEqual(kinds(code), ['tmp-file', 'tmp-file', 'signal', 'trace-id']);
});

test('leaves local variables and constants alone', () => {
  const code = `const TABLE = 'tickets'; export const handler = async (e) => { let total = 0; total += e.n; return { TABLE, total }; };`;
  assert.deepEqual(kinds(code), []);
});
