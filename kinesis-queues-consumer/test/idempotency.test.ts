// test/idempotency.test.ts
import { ConditionalCheckFailedException, DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { DynamoIdempotencyStore } from '../src/idempotency.js';

const ddb = mockClient(DynamoDBClient);
const conflict = (status: string) =>
  new ConditionalCheckFailedException({ message: 'conditional check failed', $metadata: {}, Item: { status: { S: status } } });

describe('DynamoIdempotencyStore', () => {
  beforeEach(() => ddb.reset());
  const store = () => new DynamoIdempotencyStore(new DynamoDBClient({}), 'ticket-mail-idempotency');

  it('claims a new key', async () => {
    ddb.on(UpdateItemCommand).resolves({});
    expect(await store().claim('ticket-mail#1')).toBe('claimed');
  });

  it('reports done when the mail was already sent', async () => {
    ddb.on(UpdateItemCommand).rejects(conflict('DONE'));
    expect(await store().claim('ticket-mail#1')).toBe('done');
  });

  it('reports busy while another worker holds the lease', async () => {
    ddb.on(UpdateItemCommand).rejects(conflict('PENDING'));
    expect(await store().claim('ticket-mail#1')).toBe('busy');
  });
});
