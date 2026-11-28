// seed.ts – writes 60 sample rentals for the station "harbor"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient, type BatchWriteCommandInput, type BatchWriteCommandOutput } from "@aws-sdk/lib-dynamodb";

const tableName = process.argv[2];
if (!tableName) throw new Error("Usage: node seed.ts <table name>");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const rentals = Array.from({ length: 60 }, (_, i) => {
  const startedAt = new Date(Date.UTC(2026, 10, 1, 8) + i * 15 * 60_000).toISOString();
  const rentalId = `r-${String(i + 1).padStart(3, "0")}`;
  return {
    pk: "STATION#harbor",
    sk: `RENTAL#${startedAt}#${rentalId}`,
    rentalId,
    bikeId: `bike-${(i % 12) + 1}`,
    startedAt,
    status: i % 4 === 0 ? "open" : "returned",
  };
});

for (let i = 0; i < rentals.length; i += 25) {
  const chunk = rentals.slice(i, i + 25);
  let requestItems: BatchWriteCommandInput["RequestItems"] = {
    [tableName]: chunk.map((Item) => ({ PutRequest: { Item } })),
  };
  // Resend unprocessed items (happens under throttling)
  while (requestItems && Object.keys(requestItems).length > 0) {
    const result: BatchWriteCommandOutput = await client.send(new BatchWriteCommand({ RequestItems: requestItems }));
    requestItems = result.UnprocessedItems;
  }
}
console.log(`${rentals.length} rentals written`);
