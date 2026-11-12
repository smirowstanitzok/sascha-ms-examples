// test/reservation.int.test.ts
import { randomUUID } from "node:crypto";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  GetItemCommand,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";
import {
  CreateQueueCommand,
  DeleteQueueCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handler } from "../src/reservation.js";

const dynamo = new DynamoDBClient({});
const sqs = new SQSClient({});
// Unique names per run, so parallel test files do not collide.
const suffix = randomUUID().slice(0, 8);
const tableName = `bike-reservations-${suffix}`;
let queueUrl = "";

const request = (body: unknown) => ({ body: JSON.stringify(body) }) as APIGatewayProxyEventV2;

async function callHandler(body: unknown): Promise<APIGatewayProxyStructuredResultV2> {
  return (await handler(request(body))) as APIGatewayProxyStructuredResultV2;
}

beforeAll(async () => {
  await dynamo.send(
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
    }),
  );
  await waitUntilTableExists({ client: dynamo, maxWaitTime: 30 }, { TableName: tableName });
  const queue = await sqs.send(new CreateQueueCommand({ QueueName: `reservation-events-${suffix}` }));
  queueUrl = queue.QueueUrl!;
  process.env.TABLE_NAME = tableName;
  process.env.QUEUE_URL = queueUrl;
});

afterAll(async () => {
  await dynamo.send(new DeleteTableCommand({ TableName: tableName }));
  await sqs.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
});

describe("create reservation", () => {
  it("stores the reservation and publishes an event", async () => {
    const result = await callHandler({ bikeId: "e-42", day: "2026-11-20", customerId: "c-7" });
    expect(result.statusCode).toBe(201);

    const item = await dynamo.send(
      new GetItemCommand({
        TableName: tableName,
        Key: { pk: { S: "BIKE#e-42" }, sk: { S: "DAY#2026-11-20" } },
      }),
    );
    expect(item.Item?.customerId?.S).toBe("c-7");

    const messages = await sqs.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl, WaitTimeSeconds: 1, MaxNumberOfMessages: 1 }),
    );
    expect(JSON.parse(messages.Messages?.[0]?.Body ?? "{}")).toMatchObject({
      type: "ReservationCreated",
      bikeId: "e-42",
    });
  });

  it("rejects a double booking with 409", async () => {
    await callHandler({ bikeId: "e-43", day: "2026-11-21", customerId: "c-1" });
    const second = await callHandler({ bikeId: "e-43", day: "2026-11-21", customerId: "c-2" });
    expect(second.statusCode).toBe(409);
  });

  it("returns 400 for an invalid day", async () => {
    const result = await callHandler({ bikeId: "e-44", day: "tomorrow", customerId: "c-3" });
    expect(result.statusCode).toBe(400);
  });
});
