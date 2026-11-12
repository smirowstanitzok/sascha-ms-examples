// src/reservation.ts
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

// No emulator-specific code: endpoint, credentials and region come from the environment.
const dynamo = new DynamoDBClient({});
const sqs = new SQSClient({});

type ReservationRequest = { bikeId: string; day: string; customerId: string };

function parse(body: string | undefined): ReservationRequest | undefined {
  try {
    const data = JSON.parse(body ?? "{}");
    const valid =
      typeof data.bikeId === "string" &&
      typeof data.customerId === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(data.day ?? "");
    return valid ? data : undefined;
  } catch {
    return undefined;
  }
}

const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const request = parse(event.body);
  if (!request) {
    return json(400, { message: "bikeId, customerId and day (YYYY-MM-DD) are required" });
  }

  try {
    // One bike per day: the condition prevents double bookings.
    await dynamo.send(
      new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
          pk: { S: `BIKE#${request.bikeId}` },
          sk: { S: `DAY#${request.day}` },
          customerId: { S: request.customerId },
          createdAt: { S: new Date().toISOString() },
        },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return json(409, { message: "Bike is already booked on this day" });
    }
    throw error;
  }

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: process.env.QUEUE_URL,
      MessageBody: JSON.stringify({ type: "ReservationCreated", ...request }),
    }),
  );

  return json(201, { bikeId: request.bikeId, day: request.day });
}
