// test/gaps.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findGaps, formatReport, httpApiGaps, functionUrlGaps, restCatchAllGaps } from '../src/gaps.ts';

test('HTTP API with an open route is high', () => {
  const [gap] = httpApiGaps([
    {
      apiId: 'a1',
      name: 'bike-rental-api',
      protocolType: 'HTTP',
      endpoint: 'https://a1.execute-api.eu-central-1.amazonaws.com',
      executeApiDisabled: false,
      routes: [
        { routeKey: 'GET /bikes', authorizationType: 'NONE' },
        { routeKey: 'POST /rentals', authorizationType: 'JWT' },
        { routeKey: 'OPTIONS /bikes', authorizationType: 'NONE' },
      ],
    },
  ]);
  assert.equal(gap.severity, 'high');
  assert.match(gap.reason, /1 route\(s\) without authorization \(GET \/bikes\)/);
});

test('HTTP API with disabled default endpoint is only medium', () => {
  const [gap] = httpApiGaps([
    {
      apiId: 'a2',
      name: 'internal-api',
      protocolType: 'HTTP',
      endpoint: 'https://a2.execute-api.eu-central-1.amazonaws.com',
      executeApiDisabled: true,
      routes: [{ routeKey: 'GET /health', authorizationType: 'NONE' }],
    },
  ]);
  assert.equal(gap.severity, 'medium');
});

test('WebSocket API is reported as not discovered', () => {
  const [gap] = httpApiGaps([
    { apiId: 'w1', name: 'live-ticker', protocolType: 'WEBSOCKET', endpoint: 'wss://w1', executeApiDisabled: false, routes: [] },
  ]);
  assert.equal(gap.kind, 'websocket-api');
  assert.equal(gap.severity, 'medium');
});

test('Function URL without auth is high, with IAM only info', () => {
  const gaps = functionUrlGaps([
    { functionName: 'bakery-orders', url: 'https://x.lambda-url.eu-central-1.on.aws/', authType: 'NONE' },
    { functionName: 'bakery-admin', url: 'https://y.lambda-url.eu-central-1.on.aws/', authType: 'AWS_IAM' },
  ]);
  assert.deepEqual(gaps.map((g) => g.severity), ['high', 'info']);
});

test('REST catch-all methods are found, literal paths are not', () => {
  const gaps = restCatchAllGaps([
    { apiId: 'r1', apiName: 'library', path: '/books', httpMethod: 'GET' },
    { apiId: 'r1', apiName: 'library', path: '/{proxy+}', httpMethod: 'POST' },
    { apiId: 'r1', apiName: 'library', path: '/loans', httpMethod: 'ANY' },
  ]);
  assert.deepEqual(gaps.map((g) => g.endpoint), ['POST /{proxy+}', 'ANY /loans']);
});

test('findGaps sorts by severity and the report counts correctly', () => {
  const gaps = findGaps({
    httpApis: [],
    functionUrls: [{ functionName: 'tickets', url: 'https://t/', authType: 'NONE' }],
    restMethods: [{ apiId: 'r1', apiName: 'library', path: '/{proxy+}', httpMethod: 'ANY' }],
  });
  assert.deepEqual(gaps.map((g) => g.severity), ['high', 'info']);
  const report = formatReport(gaps, 'eu-central-1');
  assert.match(report, /2 finding\(s\)/);
  assert.match(report, /high: 1, medium: 0, info: 1/);
});

test('empty input gives a clear all-clear message', () => {
  assert.match(formatReport([], 'eu-central-1'), /No gaps found in eu-central-1/);
});
