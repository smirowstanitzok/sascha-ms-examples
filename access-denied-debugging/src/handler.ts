// src/handler.ts
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { logIfAccessDenied } from "./log-denied";

const sqs = new SQSClient({});

// Fictional bike rental: a customer returns a bike at a station,
// the API puts a message on the queue for the workshop.
export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const body = JSON.parse(event.body ?? "{}") as { bikeId?: string; stationId?: string };
  if (!body.bikeId || !body.stationId) {
    return { statusCode: 400, body: JSON.stringify({ error: "bikeId and stationId are required" }) };
  }

  try {
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: process.env.RETURNS_QUEUE_URL,
        MessageBody: JSON.stringify({ ...body, returnedAt: new Date().toISOString() }),
      }),
    );
    return { statusCode: 202, body: JSON.stringify({ status: "accepted" }) };
  } catch (error) {
    logIfAccessDenied(error, "sqs:SendMessage");
    throw error;
  }
};
