// src/return-bike.ts
import {
  EventBridgeV2Client,
  PutEventsCommand,
  type PutEventsCommandOutput,
  type PutEventsRequestEntry,
} from '@aws-sdk/client-eventbridgev2';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { BIKE_RETURNED, EVENT_SOURCE, bikeReturnedSchema, type BikeReturned } from './events.ts';

// What the app sends on return; the server sets the timestamp
const requestSchema = bikeReturnedSchema.omit({ returnedAt: true });

export interface EventSender {
  send(command: PutEventsCommand): Promise<PutEventsCommandOutput>;
}

export const buildEntry = (ride: BikeReturned): PutEventsRequestEntry => ({
  Source: EVENT_SOURCE,
  DetailType: BIKE_RETURNED,
  Detail: JSON.stringify(ride),
  SystemMetadata: {
    // Ordering applies per group: all returns of one customer form a group
    EventGroupId: ride.customerId,
    // Business key: the same return sent twice results in one event
    DeduplicationId: ride.returnId,
  },
});

const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const createHandler =
  (events: EventSender, busArn: string) =>
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    let input: unknown;
    try {
      input = JSON.parse(event.body ?? '');
    } catch {
      return json(400, { message: 'Body is not valid JSON' });
    }

    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) {
      return json(400, { message: 'Invalid return', issues: parsed.error.issues });
    }

    const ride: BikeReturned = { ...parsed.data, returnedAt: new Date().toISOString() };
    const response = await events.send(
      new PutEventsCommand({ EventBusArn: busArn, Entries: [buildEntry(ride)] }),
    );

    // The call can succeed while single entries fail: check every entry
    const result = response.Entries?.[0];
    if (!result || result.ErrorCode) {
      console.error(JSON.stringify({ msg: 'Event not accepted', returnId: ride.returnId, result }));
      return json(502, { message: 'Return could not be reported' });
    }

    // DEDUPLICATED is a success: the return was already reported
    return json(202, { returnId: ride.returnId, status: result.SuccessCode });
  };

export const handler = createHandler(new EventBridgeV2Client({}), process.env.EVENT_BUS_ARN ?? '');
