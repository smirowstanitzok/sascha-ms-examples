// app/src/bike-store.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

export type Bike = {
  bikeId: string;
  model: string;
  status: "available" | "rented";
};

export type RentResult = "rented" | "not-found" | "already-rented";

export interface BikeStore {
  get(bikeId: string): Promise<Bike | undefined>;
  create(bike: Bike): Promise<void>;
  rent(bikeId: string): Promise<RentResult>;
}

// Production: DynamoDB. The client is created ONCE per environment
// and shared by all parallel requests – that is exactly what we want.
class DynamoBikeStore implements BikeStore {
  private readonly db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  constructor(private readonly tableName: string) {}

  async get(bikeId: string): Promise<Bike | undefined> {
    const out = await this.db.send(
      new GetCommand({ TableName: this.tableName, Key: { bikeId } }),
    );
    return out.Item as Bike | undefined;
  }

  async create(bike: Bike): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: bike,
        ConditionExpression: "attribute_not_exists(bikeId)",
      }),
    );
  }

  async rent(bikeId: string): Promise<RentResult> {
    try {
      await this.db.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { bikeId },
          // Only one request wins: the status is checked and set atomically
          ConditionExpression: "attribute_exists(bikeId) AND #s = :available",
          UpdateExpression: "SET #s = :rented",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: { ":available": "available", ":rented": "rented" },
        }),
      );
      return "rented";
    } catch (err) {
      if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
        return (await this.get(bikeId)) ? "already-rented" : "not-found";
      }
      throw err;
    }
  }
}

// Locally without AWS: same rules, data only in this process's memory
class InMemoryBikeStore implements BikeStore {
  private readonly bikes = new Map<string, Bike>();

  async get(bikeId: string): Promise<Bike | undefined> {
    return this.bikes.get(bikeId);
  }

  async create(bike: Bike): Promise<void> {
    if (this.bikes.has(bike.bikeId)) throw new Error("Bike exists");
    this.bikes.set(bike.bikeId, { ...bike });
  }

  async rent(bikeId: string): Promise<RentResult> {
    const bike = this.bikes.get(bikeId);
    if (!bike) return "not-found";
    if (bike.status !== "available") return "already-rented";
    bike.status = "rented";
    return "rented";
  }
}

export function createBikeStore(): BikeStore {
  const tableName = process.env.TABLE_NAME;
  return tableName ? new DynamoBikeStore(tableName) : new InMemoryBikeStore();
}
