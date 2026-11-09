// src/bike-repository.ts
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { Bike } from './bike.js';

export class VersionConflictError extends Error {
  constructor(
    public readonly bikeId: string,
    public readonly expectedVersion: number,
    public readonly current?: Bike,
  ) {
    super(`Bike ${bikeId} was changed in the meantime (expected version ${expectedVersion})`);
    this.name = 'VersionConflictError';
  }
}

export class BikeAlreadyExistsError extends Error {
  constructor(public readonly bikeId: string) {
    super(`Bike ${bikeId} already exists`);
    this.name = 'BikeAlreadyExistsError';
  }
}

export class BikeRepository {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async get(bikeId: string): Promise<Bike | undefined> {
    const result = await this.db.send(
      new GetCommand({ TableName: this.tableName, Key: { bikeId }, ConsistentRead: true }),
    );
    return result.Item as Bike | undefined;
  }

  /** Creates a bike with version 1 and never overwrites an existing one. */
  async create(bike: Omit<Bike, 'version'>): Promise<Bike> {
    const item: Bike = { ...bike, version: 1 };
    try {
      await this.db.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: 'attribute_not_exists(bikeId)',
        }),
      );
      return item;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) throw new BikeAlreadyExistsError(bike.bikeId);
      throw error;
    }
  }

  /**
   * Saves the new state only if nobody has changed the item since it was read.
   * `next.version` is the version that was read; the stored item gets version + 1.
   */
  async save(next: Bike): Promise<Bike> {
    const expectedVersion = next.version;
    const item: Bike = { ...next, version: expectedVersion + 1 };
    try {
      await this.db.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: '#version = :expected',
          ExpressionAttributeNames: { '#version': 'version' },
          ExpressionAttributeValues: { ':expected': expectedVersion },
          ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
        }),
      );
      return item;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        // The document client does not convert the item in the error: it is still in AttributeValue format.
        const current = error.Item ? (unmarshall(error.Item) as Bike) : undefined;
        throw new VersionConflictError(next.bikeId, expectedVersion, current);
      }
      throw error;
    }
  }
}
