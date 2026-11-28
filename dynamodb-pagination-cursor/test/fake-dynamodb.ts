// test/fake-dynamodb.ts
// Minimal replica of Query behavior: sorting, ExclusiveStartKey,
// Limit BEFORE the filter, LastEvaluatedKey after the last item read.
import type { QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { Rental } from "../src/list-rentals.js";

export function createFakeClient(rows: Rental[]) {
  const calls: Array<Record<string, unknown>> = [];
  return {
    calls,
    async send(command: QueryCommand) {
      const input = command.input;
      calls.push(input as Record<string, unknown>);
      const values = input.ExpressionAttributeValues ?? {};
      const forward = input.ScanIndexForward !== false;

      let candidates = rows
        .filter((r) => r.pk === values[":pk"] && r.sk.startsWith(values[":prefix"]))
        .sort((a, b) => (forward ? a.sk.localeCompare(b.sk) : b.sk.localeCompare(a.sk)));

      const start = input.ExclusiveStartKey as { sk: string } | undefined;
      if (start) {
        candidates = candidates.filter((r) => (forward ? r.sk > start.sk : r.sk < start.sk));
      }

      const evaluated = candidates.slice(0, input.Limit ?? candidates.length);
      const items = input.FilterExpression
        ? evaluated.filter((r) => r.status === values[":status"])
        : evaluated;
      const last = evaluated[evaluated.length - 1];
      const more = evaluated.length < candidates.length;

      return {
        Items: items,
        LastEvaluatedKey: more && last ? { pk: last.pk, sk: last.sk } : undefined,
      };
    },
  };
}

export function rentalsFor(stationId: string, count: number, everyNthOpen = 1): Rental[] {
  return Array.from({ length: count }, (_, i) => {
    const n = String(i).padStart(3, "0");
    const startedAt = `2026-11-01T10:${String(i % 60).padStart(2, "0")}:00Z`;
    return {
      pk: `STATION#${stationId}`,
      sk: `RENTAL#${n}#r-${n}`,
      rentalId: `r-${n}`,
      bikeId: `bike-${i % 7}`,
      startedAt,
      status: i % everyNthOpen === 0 ? "open" : "returned",
    };
  });
}
