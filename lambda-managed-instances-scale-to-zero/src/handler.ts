// src/handler.ts
// Creates a maintenance report for a bike rental station.
// Runs on Lambda Managed Instances: several invocations share one
// execution environment, so there is no mutable global state here.

export interface Rental {
  bikeId: string;
  kilometers: number;
}

export interface ReportRequest {
  stationId: string;
  rentals: Rental[];
  serviceIntervalKm?: number;
}

export interface MaintenanceReport {
  stationId: string;
  bikesChecked: number;
  bikesDue: { bikeId: string; totalKm: number }[];
  createdAt: string;
}

interface LambdaContextLike {
  awsRequestId: string;
  getRemainingTimeInMillis(): number;
}

const DEFAULT_SERVICE_INTERVAL_KM = 500;
const SAFETY_MARGIN_MS = 2_000;

export function buildReport(request: ReportRequest, now: Date = new Date()): MaintenanceReport {
  const interval = request.serviceIntervalKm ?? DEFAULT_SERVICE_INTERVAL_KM;
  // Sum up kilometers per bike – local to the invocation, not global
  const totals = new Map<string, number>();
  for (const rental of request.rentals) {
    totals.set(rental.bikeId, (totals.get(rental.bikeId) ?? 0) + rental.kilometers);
  }
  const bikesDue = [...totals.entries()]
    .filter(([, totalKm]) => totalKm >= interval)
    .map(([bikeId, totalKm]) => ({ bikeId, totalKm }))
    .sort((a, b) => b.totalKm - a.totalKm);

  return {
    stationId: request.stationId,
    bikesChecked: totals.size,
    bikesDue,
    createdAt: now.toISOString(),
  };
}

export const handler = async (
  event: ReportRequest,
  context: LambdaContextLike,
): Promise<MaintenanceReport> => {
  if (context.getRemainingTimeInMillis() < SAFETY_MARGIN_MS) {
    throw new Error('Not enough remaining time for the report');
  }
  const report = buildReport(event);
  // console.log adds the requestId to the JSON log automatically
  console.log(JSON.stringify({ msg: 'Report created', stationId: report.stationId, due: report.bikesDue.length }));
  return report;
};
