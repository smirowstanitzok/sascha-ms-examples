// src/battery-diagnosis.ts
import { setTimeout as sleep } from 'node:timers/promises';

export interface BatteryReport {
  bikeId: string;
  healthPercent: number;
  chargeCycles: number;
  verdict: 'ok' | 'replace';
}

/** The bike does not respond – a temporary error, another attempt is worthwhile. */
export class BikeOfflineError extends Error {
  constructor(bikeId: string) {
    super(`E-bike ${bikeId} is not reachable`);
    this.name = 'BikeOfflineError';
  }
}

const STEP_MS = Number(process.env.DIAGNOSIS_STEP_MS ?? '15000');

/**
 * Simulated battery diagnosis in three steps (voltage, cycles, capacity test).
 * In real life, this would query the battery's interface.
 */
export async function runBatteryDiagnosis(bikeId: string, signal: AbortSignal): Promise<BatteryReport> {
  if (bikeId.startsWith('offline-')) throw new BikeOfflineError(bikeId);

  for (const step of ['voltage', 'charge cycles', 'capacity test']) {
    console.log(`Diagnosis ${bikeId}: ${step}`);
    await sleep(STEP_MS, undefined, { signal });
  }

  const seed = [...bikeId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const healthPercent = 55 + (seed % 45);
  return {
    bikeId,
    healthPercent,
    chargeCycles: 120 + (seed % 600),
    verdict: healthPercent < 70 ? 'replace' : 'ok',
  };
}
