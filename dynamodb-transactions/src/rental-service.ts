// src/rental-service.ts
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";

export const MAX_ACTIVE_RENTALS = 2;

export interface StartRentalInput {
  rentalId: string; // comes from the Idempotency-Key header (UUID, max. 36 characters)
  customerId: string;
  bikeId: string;
  stationId: string;
  startedAt: string;
}

export interface ReturnRentalInput {
  rentalId: string;
  returnedAt: string;
}

export type RentalError =
  | "STATION_CLOSED"
  | "CUSTOMER_BLOCKED"
  | "RENTAL_LIMIT_REACHED"
  | "BIKE_NOT_AVAILABLE"
  | "RENTAL_ALREADY_EXISTS"
  | "RENTAL_NOT_OPEN"
  | "CONFLICT"
  | "UNKNOWN";

export class RentalRejectedError extends Error {
  constructor(public readonly reason: RentalError) {
    super(reason);
    this.name = "RentalRejectedError";
  }
}

export const keys = {
  station: (id: string) => ({ pk: `STATION#${id}` }),
  customer: (id: string) => ({ pk: `CUSTOMER#${id}` }),
  bike: (id: string) => ({ pk: `BIKE#${id}` }),
  rental: (id: string) => ({ pk: `RENTAL#${id}` }),
};

// Order matters: CancellationReasons arrive in exactly this order.
export function buildStartRentalTransaction(
  tableName: string,
  input: StartRentalInput,
): TransactWriteCommandInput {
  return {
    // No own ClientRequestToken: the SDK sets one per call, and startedAt changes on every
    // client retry (same token + different parameters = IdempotentParameterMismatch).
    TransactItems: [
      {
        ConditionCheck: {
          TableName: tableName,
          Key: keys.station(input.stationId),
          ConditionExpression: "isOpen = :true",
          ExpressionAttributeValues: { ":true": true },
        },
      },
      {
        Update: {
          TableName: tableName,
          Key: keys.customer(input.customerId),
          UpdateExpression: "SET activeRentals = activeRentals + :one",
          ConditionExpression: "accountStatus = :active AND activeRentals < :max",
          ExpressionAttributeValues: { ":one": 1, ":active": "active", ":max": MAX_ACTIVE_RENTALS },
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        },
      },
      {
        Update: {
          TableName: tableName,
          Key: keys.bike(input.bikeId),
          UpdateExpression: "SET bikeStatus = :rented, rentalId = :rentalId",
          ConditionExpression: "bikeStatus = :available AND stationId = :stationId",
          ExpressionAttributeValues: {
            ":rented": "rented",
            ":available": "available",
            ":rentalId": input.rentalId,
            ":stationId": input.stationId,
          },
        },
      },
      {
        Put: {
          TableName: tableName,
          Item: {
            ...keys.rental(input.rentalId),
            rentalStatus: "open",
            customerId: input.customerId,
            bikeId: input.bikeId,
            stationId: input.stationId,
            startedAt: input.startedAt,
          },
          ConditionExpression: "attribute_not_exists(pk)",
        },
      },
    ],
  };
}

export function buildReturnRentalTransaction(
  tableName: string,
  rental: { rentalId: string; customerId: string; bikeId: string },
  returnedAt: string,
): TransactWriteCommandInput {
  return {
    TransactItems: [
      {
        Update: {
          TableName: tableName,
          Key: keys.rental(rental.rentalId),
          UpdateExpression: "SET rentalStatus = :returned, returnedAt = :at",
          ConditionExpression: "rentalStatus = :open",
          ExpressionAttributeValues: { ":returned": "returned", ":open": "open", ":at": returnedAt },
        },
      },
      {
        Update: {
          TableName: tableName,
          Key: keys.bike(rental.bikeId),
          UpdateExpression: "SET bikeStatus = :available REMOVE rentalId",
          ConditionExpression: "rentalId = :rentalId",
          ExpressionAttributeValues: { ":available": "available", ":rentalId": rental.rentalId },
        },
      },
      {
        Update: {
          TableName: tableName,
          Key: keys.customer(rental.customerId),
          UpdateExpression: "SET activeRentals = activeRentals - :one",
          ConditionExpression: "activeRentals > :zero",
          ExpressionAttributeValues: { ":one": 1, ":zero": 0 },
        },
      },
    ],
  };
}

interface Reason {
  Code?: string;
  Item?: Record<string, unknown>;
}

// Maps the position-based CancellationReasons to a domain error.
export function explainStartCancellation(reasons: Reason[] = []): RentalError {
  if (reasons.some((r) => r.Code === "TransactionConflict")) return "CONFLICT";
  const [station, customer, bike, rental] = reasons;
  if (rental?.Code === "ConditionalCheckFailed") return "RENTAL_ALREADY_EXISTS";
  if (station?.Code === "ConditionalCheckFailed") return "STATION_CLOSED";
  if (customer?.Code === "ConditionalCheckFailed") {
    return customer.Item?.accountStatus === "active" ? "RENTAL_LIMIT_REACHED" : "CUSTOMER_BLOCKED";
  }
  if (bike?.Code === "ConditionalCheckFailed") return "BIKE_NOT_AVAILABLE";
  return "UNKNOWN";
}

export function explainReturnCancellation(reasons: Reason[] = []): RentalError {
  if (reasons.some((r) => r.Code === "TransactionConflict")) return "CONFLICT";
  if (reasons[0]?.Code === "ConditionalCheckFailed") return "RENTAL_NOT_OPEN";
  return "UNKNOWN";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The SDK does not retry TransactionCanceledException – we only retry real conflicts.
export async function sendWithConflictRetry(
  client: Pick<DynamoDBDocumentClient, "send">,
  input: TransactWriteCommandInput,
  explain: (reasons?: Reason[]) => RentalError,
  maxAttempts = 3,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await client.send(new TransactWriteCommand(input));
      return;
    } catch (error) {
      if (!(error instanceof TransactionCanceledException)) throw error;
      const reason = explain(error.CancellationReasons as Reason[] | undefined);
      if (reason !== "CONFLICT" || attempt >= maxAttempts) throw new RentalRejectedError(reason);
      await sleep(Math.random() * 50 * 2 ** attempt); // full jitter
    }
  }
}

export class RentalService {
  constructor(
    private readonly client: Pick<DynamoDBDocumentClient, "send">,
    private readonly tableName: string,
  ) {}

  async startRental(input: StartRentalInput): Promise<{ replayed: boolean }> {
    try {
      await sendWithConflictRetry(
        this.client,
        buildStartRentalTransaction(this.tableName, input),
        explainStartCancellation,
      );
      return { replayed: false };
    } catch (error) {
      // Same key again: the rental already exists.
      if (error instanceof RentalRejectedError && error.reason === "RENTAL_ALREADY_EXISTS") {
        const existing = await this.getRental(input.rentalId);
        if (existing?.customerId === input.customerId && existing.bikeId === input.bikeId) {
          return { replayed: true };
        }
      }
      throw error;
    }
  }

  async returnRental(input: ReturnRentalInput): Promise<void> {
    const rental = await this.getRental(input.rentalId);
    if (!rental) throw new RentalRejectedError("RENTAL_NOT_OPEN");
    await sendWithConflictRetry(
      this.client,
      buildReturnRentalTransaction(
        this.tableName,
        { rentalId: input.rentalId, customerId: rental.customerId, bikeId: rental.bikeId },
        input.returnedAt,
      ),
      explainReturnCancellation,
    );
  }

  async getRental(rentalId: string) {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: keys.rental(rentalId), ConsistentRead: true }),
    );
    return result.Item as
      | { customerId: string; bikeId: string; rentalStatus: string }
      | undefined;
  }
}
