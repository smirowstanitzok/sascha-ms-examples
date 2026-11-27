// test/prompt.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJudgeOutput } from '../src/prompt.ts';

test('reads a valid verdict', () => {
  const r = parseJudgeOutput('{"reason": "price is correct", "verdict": "PASS"}');
  assert.equal(r.verdict, 'pass');
});

test('finds JSON surrounded by text', () => {
  const r = parseJudgeOutput('Here is my verdict:\n{"reason": "wrong deadline", "verdict": "fail"}');
  assert.equal(r.verdict, 'fail');
});

test('unknown values become unknown', () => {
  assert.equal(parseJudgeOutput('{"verdict": "maybe"}').verdict, 'unknown');
  assert.equal(parseJudgeOutput('no JSON').verdict, 'unknown');
});
