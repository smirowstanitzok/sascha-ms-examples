// src/metrics.ts
export type Source = "exact" | "semantic" | "model" | "no-cache";

/** Writes a metric in Embedded Metric Format; CloudWatch turns it into metrics. */
export function recordRequest(source: Source, distance?: number): void {
  const metrics: { Name: string; Unit: string }[] = [{ Name: "Requests", Unit: "Count" }];
  const values: Record<string, number> = { Requests: 1 };
  if (distance !== undefined && Number.isFinite(distance)) {
    metrics.push({ Name: "Distance", Unit: "None" });
    values.Distance = distance;
  }
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [{ Namespace: "BikeStation/FAQ", Dimensions: [["Source"]], Metrics: metrics }],
      },
      Source: source,
      ...values,
    }),
  );
}
