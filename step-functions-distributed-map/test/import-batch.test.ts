// test/import-batch.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

process.env.TABLE_NAME = 'books-test';
const { handler } = await import('../src/import-batch.js');

const goodRow = (n: number) => ({ isbn: '9783161484100', title: `Book ${n}`, author: 'X', year: '2020', copies: '1' });

afterEach(() => vi.restoreAllMocks());

describe('handler', () => {
  it('writes valid rows in chunks of 25 and reports invalid ones', async () => {
    const send = vi.spyOn(DynamoDBDocumentClient.prototype, 'send').mockResolvedValue({} as never);
    const items = [...Array.from({ length: 30 }, (_, i) => goodRow(i)), { isbn: '42', title: 'broken' }];

    const result = await handler({ Items: items, BatchInput: { source: 'test' } });

    expect(result.written).toBe(30);
    expect(result.rejected).toEqual([{ isbn: '42', reason: 'invalid ISBN' }]);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('resends unprocessed items', async () => {
    const send = vi
      .spyOn(DynamoDBDocumentClient.prototype, 'send')
      .mockResolvedValueOnce({ UnprocessedItems: { 'books-test': [{ PutRequest: { Item: { isbn: '1' } } }] } } as never)
      .mockResolvedValueOnce({} as never);

    await handler({ Items: [goodRow(1)] });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('throws after five unsuccessful attempts', async () => {
    vi.spyOn(DynamoDBDocumentClient.prototype, 'send').mockResolvedValue({
      UnprocessedItems: { 'books-test': [{ PutRequest: { Item: { isbn: '1' } } }] },
    } as never);

    await expect(handler({ Items: [goodRow(1)] })).rejects.toThrow(/after 5 attempts/);
  });
});
