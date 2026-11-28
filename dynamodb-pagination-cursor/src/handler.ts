// src/handler.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { decodeCursor, encodeCursor, InvalidCursorError } from "./cursor.js";
import { listRentals, type Rental } from "./list-rentals.js";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME ?? "";
const CURSOR_SECRET = process.env.CURSOR_SECRET ?? "";

const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const stationId = event.pathParameters?.stationId;
  const query = event.queryStringParameters ?? {};

  if (!stationId || !/^[a-z0-9-]{1,40}$/.test(stationId)) {
    return json(400, { message: "Invalid stationId" });
  }

  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return json(400, { message: "limit must be between 1 and 100" });
  }

  const status = query.status;
  if (status !== undefined && status !== "open" && status !== "returned") {
    return json(400, { message: "status must be open or returned" });
  }

  // The cursor is only valid for exactly this station and this filter.
  const fingerprint = `${stationId}|${status ?? "*"}`;

  let startKey;
  if (query.cursor) {
    try {
      startKey = decodeCursor(query.cursor, fingerprint, CURSOR_SECRET);
    } catch (err) {
      if (err instanceof InvalidCursorError) return json(400, { message: err.message });
      throw err;
    }
  }

  const result = await listRentals(client, {
    tableName: TABLE_NAME,
    stationId,
    limit,
    status: status as Rental["status"] | undefined,
    startKey,
  });

  return json(200, {
    items: result.items.map(({ pk, sk, ...rest }) => rest), // do not expose internal keys
    nextCursor: result.nextKey ? encodeCursor(result.nextKey, fingerprint, CURSOR_SECRET) : null,
  });
}
