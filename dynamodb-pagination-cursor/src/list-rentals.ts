// src/list-rentals.ts
import { DynamoDBDocumentClient, QueryCommand, type QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import type { PageKey } from "./cursor.js";

export type Rental = {
  pk: string;
  sk: string;
  rentalId: string;
  bikeId: string;
  startedAt: string;
  status: "open" | "returned";
};

export type ListRentalsInput = {
  tableName: string;
  stationId: string;
  limit: number; // requested number of items per page
  status?: Rental["status"]; // optional filter
  startKey?: PageKey; // from the cursor
  maxRounds?: number; // guards against endless loops with rare matches
};

export type ListRentalsResult = { items: Rental[]; nextKey?: PageKey };

const keyOf = (item: Rental): PageKey => ({ pk: item.pk, sk: item.sk });

type QueryClient = Pick<DynamoDBDocumentClient, "send">;

export async function listRentals(
  client: QueryClient,
  input: ListRentalsInput,
): Promise<ListRentalsResult> {
  const { tableName, stationId, limit, status, maxRounds = 5 } = input;
  const items: Rental[] = [];
  let startKey: PageKey | undefined = input.startKey;

  for (let round = 0; round < maxRounds; round++) {
    const params: QueryCommandInput = {
      TableName: tableName,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: { ":pk": `STATION#${stationId}`, ":prefix": "RENTAL#" },
      ScanIndexForward: false, // newest rentals first
      // Without a filter, the remainder is enough. With a filter we read more,
      // because DynamoDB applies "Limit" before the filter.
      Limit: status ? Math.max(limit * 2, 25) : limit - items.length,
      ExclusiveStartKey: startKey,
    };
    if (status) {
      params.FilterExpression = "#status = :status";
      params.ExpressionAttributeNames = { "#status": "status" };
      params.ExpressionAttributeValues = { ...params.ExpressionAttributeValues, ":status": status };
    }

    const page = await client.send(new QueryCommand(params));
    const found = (page.Items ?? []) as Rental[];
    const missing = limit - items.length;

    if (found.length > missing) {
      // More matches than space: trim and build the cursor ourselves
      // from the last item the client actually receives.
      items.push(...found.slice(0, missing));
      return { items, nextKey: keyOf(items[items.length - 1]) };
    }

    items.push(...found);
    startKey = page.LastEvaluatedKey as PageKey | undefined;

    if (!startKey) return { items }; // really at the end
    if (items.length === limit) return { items, nextKey: startKey };
  }

  // round budget used up: shorter page, but with a cursor to continue
  return { items, nextKey: startKey };
}
