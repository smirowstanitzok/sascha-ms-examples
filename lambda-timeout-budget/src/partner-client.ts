// src/partner-client.ts
import { Deadline, DeadlineExceededError } from './deadline';

export interface MaintenanceStatus {
  state: 'ok' | 'in_repair' | 'unknown';
}

export interface PartnerOptions {
  baseUrl: string;
  attempts?: number;
  perAttemptMs?: number;
  fetchFn?: typeof fetch;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getMaintenanceStatus(
  bikeId: string,
  deadline: Deadline,
  { baseUrl, attempts = 2, perAttemptMs = 1500, fetchFn = fetch }: PartnerOptions,
): Promise<MaintenanceStatus> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    // Each attempt only gets what is left of the overall budget
    const signal = deadline.signalFor(`maintenance-attempt-${attempt}`, perAttemptMs);
    try {
      const res = await fetchFn(`${baseUrl}/bikes/${encodeURIComponent(bikeId)}/maintenance`, { signal });
      if (res.status >= 500) throw new Error(`Partner API responded with ${res.status}`);
      if (!res.ok) return { state: 'unknown' };
      return (await res.json()) as MaintenanceStatus;
    } catch (err) {
      if (err instanceof DeadlineExceededError) throw err;
      lastError = err;
      if (attempt < attempts) {
        // Short pause, but at most a quarter of the remaining budget
        await sleep(Math.min(200, deadline.remainingMs() / 4));
      }
    }
  }
  throw lastError;
}
