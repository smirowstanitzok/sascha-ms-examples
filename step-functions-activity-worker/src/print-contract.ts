// src/print-contract.ts
import { setTimeout as sleep } from 'node:timers/promises';

export interface PrintJob {
  rentalId: string;
  customerName: string;
  bikeId: string;
}

export class InvalidPrintJobError extends Error {
  override readonly name = 'InvalidPrintJob';
}

export function parsePrintJob(input: unknown): PrintJob {
  const job = input as Partial<PrintJob> | null;
  for (const field of ['rentalId', 'customerName', 'bikeId'] as const) {
    if (typeof job?.[field] !== 'string' || job[field].length === 0) {
      throw new InvalidPrintJobError(`Field "${field}" is missing or empty`);
    }
  }
  return job as PrintJob;
}

// Simulates the printer at the shop counter (takes a few seconds)
export async function printContract(input: unknown, signal: AbortSignal) {
  const job = parsePrintJob(input);
  const printMs = Number(process.env.PRINT_DURATION_MS ?? 3000);
  await sleep(printMs, undefined, { signal });
  return {
    rentalId: job.rentalId,
    printer: process.env.PRINTER_NAME ?? 'counter-1',
    printedAt: new Date().toISOString(),
  };
}
