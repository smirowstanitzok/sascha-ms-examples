// sandbox/execute.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeSnippet } from './execute.ts';

test('returns the output of a snippet', async () => {
  const result = await executeSnippet('console.log(6 * 7)');
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout.trim(), '42');
  assert.equal(result.timedOut, false);
});

test('reports errors on stderr', async () => {
  const result = await executeSnippet('throw new Error("broken")');
  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr, /broken/);
});

test('stops endless loops after the timeout', async () => {
  const result = await executeSnippet('while (true) {}', { timeoutMs: 500 });
  assert.equal(result.timedOut, true);
  assert.ok(result.durationMs < 3_000);
});

test('cuts off excessive output', async () => {
  const result = await executeSnippet('for (;;) console.log("x".repeat(1000))', {
    timeoutMs: 1_000,
    maxOutputBytes: 2_048,
  });
  assert.equal(result.truncated, true);
  assert.ok(result.stdout.length <= 2_048);
});

test('does not pass environment variables to the snippet', async () => {
  process.env.SECRET_TEST_VALUE = 'top-secret';
  const result = await executeSnippet('console.log(process.env.SECRET_TEST_VALUE ?? "none")');
  assert.equal(result.stdout.trim(), 'none');
});
