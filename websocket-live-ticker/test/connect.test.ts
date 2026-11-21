// test/connect.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.TABLE_NAME = 'test-table';
const { connect } = await import('../src/handlers.ts');

test('rejects connections without a valid match ID', async () => {
  const event = {
    requestContext: { connectionId: 'abc=' },
    queryStringParameters: { match: 'DROP TABLE' },
  } as unknown as Parameters<typeof connect>[0];
  const result = await connect(event);
  assert.equal(result.statusCode, 400);
});
