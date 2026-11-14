// src/import-batch.ts
// Called once per batch by a child workflow of the Distributed Map.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { validateRow, type Book, type RawRow } from './validate-row.js';

const TABLE_NAME = process.env.TABLE_NAME ?? '';
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// This is what the input looks like when ItemBatcher is enabled
export interface BatchEvent {
  Items: RawRow[];
  BatchInput?: { source?: string };
}

export interface BatchResult {
  written: number;
  rejected: { isbn: string; reason: string }[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// BatchWriteItem accepts at most 25 items; resend unprocessed items
async function writeChunk(books: Book[], source: string): Promise<void> {
  let pending: Record<string, unknown>[] = books.map((book) => ({
    PutRequest: { Item: { ...book, source, importedAt: new Date().toISOString() } },
  }));

  for (let attempt = 0; pending.length > 0; attempt++) {
    if (attempt >= 5) {
      // Hands the batch back to Step Functions: retry or failure threshold applies
      throw new Error(`${pending.length} items not written after 5 attempts`);
    }
    if (attempt > 0) await sleep(Math.random() * 100 * 2 ** attempt);

    const response = await doc.send(
      new BatchWriteCommand({ RequestItems: { [TABLE_NAME]: pending } }),
    );
    pending = (response.UnprocessedItems?.[TABLE_NAME] ?? []) as Record<string, unknown>[];
  }
}

export const handler = async (event: BatchEvent): Promise<BatchResult> => {
  const source = event.BatchInput?.source ?? 'unknown';
  const valid: Book[] = [];
  const rejected: BatchResult['rejected'] = [];

  for (const row of event.Items) {
    const result = validateRow(row);
    if (result.ok) valid.push(result.book);
    else rejected.push({ isbn: row.isbn ?? '', reason: result.reason });
  }

  for (let i = 0; i < valid.length; i += 25) {
    await writeChunk(valid.slice(i, i + 25), source);
  }

  return { written: valid.length, rejected };
};
