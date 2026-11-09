// test/bike-repository.test.ts
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { rentBike, type Bike } from '../src/bike.js';
import { BikeRepository, VersionConflictError } from '../src/bike-repository.js';
import { withOptimisticRetry } from '../src/optimistic-retry.js';

const ddb = mockClient(DynamoDBDocumentClient);
const repo = new BikeRepository(ddb as unknown as DynamoDBDocumentClient, 'bikes');
const bike: Bike = { bikeId: 'b-17', station: 'harbour', status: 'AVAILABLE', ridesSinceService: 3, version: 4 };

const conflict = (current: Bike) =>
  new ConditionalCheckFailedException({ message: 'The conditional request failed', $metadata: {}, Item: marshall(current) });

beforeEach(() => ddb.reset());

describe('BikeRepository.save', () => {
  it('writes version + 1 with a condition on the version that was read', async () => {
    ddb.on(PutCommand).resolves({});
    const saved = await repo.save({ ...bike, note: 'new bell' });
    expect(saved.version).toBe(5);
    const input = ddb.commandCalls(PutCommand)[0]!.args[0].input;
    expect(input.ConditionExpression).toBe('#version = :expected');
    expect(input.ExpressionAttributeValues).toEqual({ ':expected': 4 });
    expect(input.Item).toMatchObject({ version: 5, note: 'new bell' });
  });

  it('turns a failed condition into a VersionConflictError with the current item', async () => {
    ddb.on(PutCommand).rejects(conflict({ ...bike, version: 5, status: 'RENTED', rentedBy: 'c-9' }));
    const error = await repo.save(bike).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(VersionConflictError);
    expect((error as VersionConflictError).current).toMatchObject({ version: 5, rentedBy: 'c-9' });
  });
});

describe('withOptimisticRetry', () => {
  const noSleep = async () => {};

  it('reads again after a conflict and succeeds on the second attempt', async () => {
    ddb.on(GetCommand)
      .resolvesOnce({ Item: bike })
      .resolvesOnce({ Item: { ...bike, version: 5, note: 'changed by staff' } });
    ddb.on(PutCommand).rejectsOnce(conflict({ ...bike, version: 5 })).resolves({});

    const saved = await withOptimisticRetry(
      async () => repo.save(rentBike((await repo.get('b-17'))!, 'c-1', new Date())),
      { sleep: noSleep },
    );

    expect(saved).toMatchObject({ version: 6, rentedBy: 'c-1', note: 'changed by staff' });
    expect(ddb.commandCalls(GetCommand)).toHaveLength(2);
  });

  it('decides again on the fresh state: the second customer gets a clear rejection', async () => {
    ddb.on(GetCommand)
      .resolvesOnce({ Item: bike })
      .resolvesOnce({ Item: { ...bike, version: 5, status: 'RENTED', rentedBy: 'c-1' } });
    ddb.on(PutCommand).rejectsOnce(conflict({ ...bike, version: 5, status: 'RENTED' }));

    await expect(
      withOptimisticRetry(async () => repo.save(rentBike((await repo.get('b-17'))!, 'c-2', new Date())), {
        sleep: noSleep,
      }),
    ).rejects.toThrow(/NOT_AVAILABLE/);
  });

  it('gives up after maxAttempts and passes on the conflict', async () => {
    ddb.on(GetCommand).resolves({ Item: bike });
    ddb.on(PutCommand).rejects(conflict({ ...bike, version: 99 }));
    await expect(
      withOptimisticRetry(async () => repo.save((await repo.get('b-17'))!), { maxAttempts: 3, sleep: noSleep }),
    ).rejects.toBeInstanceOf(VersionConflictError);
    expect(ddb.commandCalls(PutCommand)).toHaveLength(3);
  });
});
