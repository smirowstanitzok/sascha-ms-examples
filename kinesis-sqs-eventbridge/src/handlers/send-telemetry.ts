// src/handlers/send-telemetry.ts
import { KinesisClient, PutRecordCommand } from "@aws-sdk/client-kinesis";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { InvalidTelemetryError, parseTelemetry } from "../lib/telemetry.js";

const kinesis = new KinesisClient({});

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const bikeId = event.pathParameters?.bikeId ?? "";
    const telemetry = parseTelemetry(bikeId, JSON.parse(event.body ?? "null"));

    // Partition key = bike ID: all records of a bike land in the same shard, in order
    const result = await kinesis.send(
      new PutRecordCommand({
        StreamName: process.env.TELEMETRY_STREAM,
        PartitionKey: telemetry.bikeId,
        Data: Buffer.from(JSON.stringify(telemetry)),
      }),
    );
    return {
      statusCode: 202,
      body: JSON.stringify({ shardId: result.ShardId, sequenceNumber: result.SequenceNumber }),
    };
  } catch (err) {
    if (err instanceof InvalidTelemetryError || err instanceof SyntaxError) {
      return { statusCode: 400, body: JSON.stringify({ message: err.message }) };
    }
    throw err;
  }
};
