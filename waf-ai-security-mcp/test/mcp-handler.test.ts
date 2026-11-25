// test/mcp-handler.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handler, processRequest } from '../lambda/mcp-handler';

test('initialize reports the protocol version', () => {
  const res: any = processRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' });
  assert.equal(res.result.protocolVersion, '2025-11-25');
});

test('tools/call finds a book', () => {
  const res: any = processRequest({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'search_books', arguments: { searchTerm: 'railway' } },
  });
  assert.match(res.result.content[0].text, /Railway/);
});

test('notification gets 202 without body', async () => {
  const res = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  } as any);
  assert.equal(res.statusCode, 202);
});

test('broken JSON returns 400', async () => {
  const res = await handler({ httpMethod: 'POST', body: '{' } as any);
  assert.equal(res.statusCode, 400);
});
