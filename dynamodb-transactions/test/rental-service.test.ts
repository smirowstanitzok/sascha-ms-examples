// test/rental-service.test.ts
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it, vi } from "vitest";
import {
  RentalService,
  buildStartRentalTransaction,
  explainStartCancellation,
} from "../src/rental-service";

const input = {
  rentalId: "6f1c2a9e-4b7d-4c1e-9a3f-2d8e5b7c1a00",
  customerId: "c-17",
  bikeId: "b-042",
  stationId: "s-hbf",
  startedAt: "2026-11-10T08:00:00.000Z",
};

const canceled = (codes: string[], customerItem?: Record<string, unknown>) =>
  new TransactionCanceledException({
    $metadata: {},
    message: "Transaction cancelled",
    CancellationReasons: codes.map((Code, i) => (i === 1 && customerItem ? { Code, Item: customerItem as never } : { Code })),
  });

describe("buildStartRentalTransaction", () => {
  it("contains four actions in a fixed order", () => {
    const tx = buildStartRentalTransaction("rentals", input);
    expect(tx.TransactItems?.map((item) => Object.keys(item)[0])).toEqual([
      "ConditionCheck",
      "Update",
      "Update",
      "Put",
    ]);
  });

  it("protects the rental against duplicates", () => {
    const put = buildStartRentalTransaction("rentals", input).TransactItems?.[3]?.Put;
    expect(put?.ConditionExpression).toBe("attribute_not_exists(pk)");
    expect(put?.Item?.pk).toBe(`RENTAL#${input.rentalId}`);
  });
});

describe("explainStartCancellation", () => {
  it("detects a closed station", () => {
    expect(explainStartCancellation([{ Code: "ConditionalCheckFailed" }, { Code: "None" }, { Code: "None" }, { Code: "None" }])).toBe("STATION_CLOSED");
  });

  it("distinguishes rental limit and blocked customer using ALL_OLD", () => {
    const limit = [{ Code: "None" }, { Code: "ConditionalCheckFailed", Item: { accountStatus: "active" } }];
    const blocked = [{ Code: "None" }, { Code: "ConditionalCheckFailed", Item: { accountStatus: "blocked" } }];
    expect(explainStartCancellation(limit)).toBe("RENTAL_LIMIT_REACHED");
    expect(explainStartCancellation(blocked)).toBe("CUSTOMER_BLOCKED");
  });

  it("treats TransactionConflict as a conflict", () => {
    expect(explainStartCancellation([{ Code: "None" }, { Code: "None" }, { Code: "TransactionConflict" }, { Code: "None" }])).toBe("CONFLICT");
  });
});

describe("RentalService.startRental", () => {
  it("retries a conflict and then succeeds", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(canceled(["None", "None", "TransactionConflict", "None"]))
      .mockResolvedValueOnce({});
    const service = new RentalService({ send } as never, "rentals");

    await expect(service.startRental(input)).resolves.toEqual({ replayed: false });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).toBeInstanceOf(TransactWriteCommand);
  });

  it("does not retry when the bike is already rented", async () => {
    const send = vi.fn().mockRejectedValue(canceled(["None", "None", "ConditionalCheckFailed", "None"]));
    const service = new RentalService({ send } as never, "rentals");

    await expect(service.startRental(input)).rejects.toMatchObject({ reason: "BIKE_NOT_AVAILABLE" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("answers a repeated request with the same key as a replay", async () => {
    const send = vi.fn(async (command: unknown) => {
      if (command instanceof GetCommand) {
        return { Item: { customerId: input.customerId, bikeId: input.bikeId, rentalStatus: "open" } };
      }
      throw canceled(["None", "ConditionalCheckFailed", "ConditionalCheckFailed", "ConditionalCheckFailed"], {
        accountStatus: "active",
      });
    });
    const service = new RentalService({ send } as never, "rentals");

    await expect(service.startRental(input)).resolves.toEqual({ replayed: true });
  });
});
