// runtime/radwerk-logger/logger.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createLogger } = require('./index.js');

test('writes one JSON line with service and data', (t) => {
  const lines = [];
  t.mock.method(console, 'log', (line) => lines.push(line));
  createLogger('rental').info('bike rented', { bikeId: 'B-17' });
  const entry = JSON.parse(lines[0]);
  assert.strictEqual(entry.service, 'rental');
  assert.strictEqual(entry.message, 'bike rented');
  assert.strictEqual(entry.bikeId, 'B-17');
});

test('suppresses debug when level is info', (t) => {
  const lines = [];
  t.mock.method(console, 'log', (line) => lines.push(line));
  process.env.RADWERK_LOG_LEVEL = 'info';
  createLogger('rental').debug('details');
  assert.strictEqual(lines.length, 0);
});
