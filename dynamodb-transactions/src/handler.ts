// src/handler.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { RentalRejectedError, RentalService, type RentalError } from "./rental-service";

const service = new RentalService(
  DynamoDBDocumentClient.from(new DynamoDBClient({})),
  process.env.TABLE_NAME ?? "",
);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS: Record<RentalError, number> = {
  STATION_CLOSED: 409,
  CUSTOMER_BLOCKED: 403,
  RENTAL_LIMIT_REACHED: 409,
  BIKE_NOT_AVAILABLE: 409,
  RENTAL_ALREADY_EXISTS: 409,
  RENTAL_NOT_OPEN: 409,
  CONFLICT: 503,
  UNKNOWN: 500,
};

const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export async function startRental(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const rentalId = event.headers["idempotency-key"] ?? "";
  if (!UUID.test(rentalId)) return json(400, { error: "Idempotency-Key must be a UUID" });

  const body = JSON.parse(event.body ?? "{}") as Partial<Record<"customerId" | "bikeId" | "stationId", string>>;
  if (!body.customerId || !body.bikeId || !body.stationId) {
    return json(400, { error: "customerId, bikeId and stationId are required" });
  }

  try {
    const { replayed } = await service.startRental({
      rentalId,
      customerId: body.customerId,
      bikeId: body.bikeId,
      stationId: body.stationId,
      startedAt: new Date().toISOString(),
    });
    return json(replayed ? 200 : 201, { rentalId, replayed });
  } catch (error) {
    if (error instanceof RentalRejectedError) return json(STATUS[error.reason], { error: error.reason });
    throw error;
  }
}

export async function returnRental(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const rentalId = event.pathParameters?.rentalId ?? "";
  try {
    await service.returnRental({ rentalId, returnedAt: new Date().toISOString() });
    return json(200, { rentalId, rentalStatus: "returned" });
  } catch (error) {
    if (error instanceof RentalRejectedError) return json(STATUS[error.reason], { error: error.reason });
    throw error;
  }
}
