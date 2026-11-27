// cost-check/rules.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFunction, checkLogGroup, toMarkdown, type FunctionInfo } from './rules.ts';

const base: FunctionInfo = {
  name: 'availability',
  architecture: 'arm64',
  memoryMb: 512,
  logFormat: 'JSON',
  appLogLevel: 'INFO',
  invocations30Days: 1200,
  provisioned: 0,
};

test('a cleanly configured function has no findings', () => {
  assert.deepEqual(checkFunction(base), []);
});

test('provisioned concurrency without invocations is a high finding', () => {
  const findings = checkFunction({ ...base, invocations30Days: 0, provisioned: 5 });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'high');
  assert.match(findings[0].hint, /around the clock/);
});

test('x86_64 and text logs are reported', () => {
  const findings = checkFunction({ ...base, architecture: 'x86_64', logFormat: 'Text' });
  assert.deepEqual(findings.map((f) => f.severity), ['medium', 'medium']);
});

test('DEBUG level in production is reported', () => {
  const findings = checkFunction({ ...base, appLogLevel: 'debug' });
  assert.match(findings[0].hint, /DEBUG|debug/);
});

test('log group without retention and lots of data is high', () => {
  const findings = checkLogGroup({ name: '/aws/lambda/old', storedBytes: 5 * 1024 ** 3 });
  assert.equal(findings[0].severity, 'high');
  assert.match(findings[0].hint, /5\.0 GiB/);
});

test('log group with 14 days retention is fine', () => {
  assert.deepEqual(checkLogGroup({ name: '/aws/lambda/ok', retentionDays: 14, storedBytes: 10 }), []);
});

test('report is sorted by severity', () => {
  const md = toMarkdown([
    { resource: 'lambda:b', severity: 'low', hint: 'x' },
    { resource: 'logs:a', severity: 'high', hint: 'y' },
  ]);
  const rows = md.split('\n');
  assert.match(rows[2], /^\| high \| logs:a/);
  assert.match(rows[3], /^\| low \| lambda:b/);
});
