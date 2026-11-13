// test/snapshot-check.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSource } from '../tools/snapshot-check';

test('flags crypto.randomUUID even inside a handler', () => {
  const src = 'function handle() {\n  const id = crypto.randomUUID();\n}';
  assert.deepEqual(checkSource('a.ts', src).map((f) => f.rule), ['node-crypto-random']);
});

test('flags a timestamp taken at module scope', () => {
  const src = 'const bootedAt = Date.now();';
  assert.equal(checkSource('a.ts', src)[0].rule, 'startup-time');
});

test('accepts a timestamp inside the handler', () => {
  const src = 'async function handle() {\n  const startedAt = Date.now();\n}';
  assert.equal(checkSource('a.ts', src).length, 0);
});

test('flags hostname and pid as instance id', () => {
  const src = "const worker = os.hostname() + process.pid;";
  assert.equal(checkSource('a.ts', src).length, 1);
});
