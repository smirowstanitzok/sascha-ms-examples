// src/lib/telemetry.ts
export interface Telemetry {
  bikeId: string;
  lat: number;
  lng: number;
  batteryPercent: number;
  recordedAt: string; // ISO-8601
}

export class InvalidTelemetryError extends Error {}

// Validates incoming data before it goes into the stream
export function parseTelemetry(bikeId: string, body: unknown): Telemetry {
  if (!/^bike-[0-9]{3,6}$/.test(bikeId)) {
    throw new InvalidTelemetryError(`Invalid bike ID: ${bikeId}`);
  }
  const b = body as Partial<Telemetry> | null;
  if (
    !b ||
    typeof b.lat !== "number" ||
    typeof b.lng !== "number" ||
    typeof b.batteryPercent !== "number" ||
    b.batteryPercent < 0 ||
    b.batteryPercent > 100
  ) {
    throw new InvalidTelemetryError("lat, lng and batteryPercent (0-100) are required");
  }
  return {
    bikeId,
    lat: b.lat,
    lng: b.lng,
    batteryPercent: b.batteryPercent,
    recordedAt: b.recordedAt ?? new Date().toISOString(),
  };
}

// Returns the latest state per bike – ordering per bike is guaranteed by the partition key
export function latestPerBike(items: Telemetry[]): Map<string, Telemetry> {
  const latest = new Map<string, Telemetry>();
  for (const item of items) {
    latest.set(item.bikeId, item);
  }
  return latest;
}

export const LOW_BATTERY_PERCENT = 20;
