// src/search-request.ts
import type { AttributeValue, SearchVectorsCommandInput } from '@aws-sdk/client-dynamodb';

export type SearchFilter = {
  genre: string; // required because the index has a partition key
  langs?: string[]; // e.g. ['de', 'en'] – becomes IN (...)
  maxPrice?: number;
  minYear?: number;
};

export function buildSearchRequest(
  tableName: string,
  indexName: string,
  vector: number[],
  filter: SearchFilter,
  topK = 5,
): SearchVectorsCommandInput {
  if (!Number.isInteger(topK) || topK < 1 || topK > 100) {
    throw new Error('topK must be between 1 and 100');
  }

  const names: Record<string, string> = { '#genre': 'genre' };
  const values: Record<string, AttributeValue> = { ':genre': { S: filter.genre } };
  const inlineFilters: string[] = [];

  if (filter.langs?.length) {
    names['#lang'] = 'lang';
    const placeholders = filter.langs.map((lang, i) => {
      values[`:lang${i}`] = { S: lang };
      return `:lang${i}`;
    });
    inlineFilters.push(`#lang IN (${placeholders.join(', ')})`);
  }
  if (filter.maxPrice !== undefined) {
    names['#price'] = 'price';
    values[':maxPrice'] = { N: String(filter.maxPrice) };
    inlineFilters.push('#price <= :maxPrice');
  }
  if (filter.minYear !== undefined) {
    names['#year'] = 'year';
    values[':minYear'] = { N: String(filter.minYear) };
    inlineFilters.push('#year >= :minYear');
  }

  // The partition key condition sits at the top level, joined with AND – never inside OR or NOT
  const expression = ['#genre = :genre', ...inlineFilters].join(' AND ');

  return {
    TableName: tableName,
    IndexName: indexName,
    SearchVector: vector.map((v) => ({ N: String(v) })),
    TopK: topK,
    SearchConditionExpression: expression,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnConsumedCapacity: 'TOTAL',
  };
}
