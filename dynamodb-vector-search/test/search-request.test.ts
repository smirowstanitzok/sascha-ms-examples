// test/search-request.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchRequest } from '../src/search-request.ts';

const vector = [0.1, -0.2, 0.3];

test('genre only: the partition key is the only condition', () => {
  const req = buildSearchRequest('Books', 'BookEmbeddingIndex', vector, { genre: 'crime' });
  assert.equal(req.SearchConditionExpression, '#genre = :genre');
  assert.deepEqual(req.SearchVector, [{ N: '0.1' }, { N: '-0.2' }, { N: '0.3' }]);
  assert.equal(req.TopK, 5);
});

test('all filters: language as IN, price and year as ranges', () => {
  const req = buildSearchRequest('Books', 'BookEmbeddingIndex', vector, {
    genre: 'crime',
    langs: ['de', 'en'],
    maxPrice: 15,
    minYear: 2020,
  });
  assert.equal(
    req.SearchConditionExpression,
    '#genre = :genre AND #lang IN (:lang0, :lang1) AND #price <= :maxPrice AND #year >= :minYear',
  );
  assert.deepEqual(req.ExpressionAttributeValues?.[':maxPrice'], { N: '15' });
  assert.deepEqual(req.ExpressionAttributeValues?.[':lang1'], { S: 'en' });
});

test('TopK outside 1 to 100 is rejected', () => {
  assert.throws(() => buildSearchRequest('Books', 'Idx', vector, { genre: 'crime' }, 101), /between 1 and 100/);
});
