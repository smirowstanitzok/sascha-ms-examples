// src/handler.ts
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

export interface ExportEvent {
  /** Number of days the bakery export is generated for */
  days?: number;
}

export interface ExportResult {
  rows: number;
  rawBytes: number;
  gzipBytes: number;
  sha256: string;
}

const PRODUCTS = ['rye bread', 'spelt roll', 'pretzel', 'apple cake', 'croissant'];

// Builds deterministic order lines so that every test run does the same amount of work.
export function buildCsv(days: number): string {
  const lines = ['date;branch;product;quantity'];
  for (let day = 0; day < days; day++) {
    const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
    for (let branch = 1; branch <= 40; branch++) {
      for (const [i, product] of PRODUCTS.entries()) {
        const amount = (day * 31 + branch * 17 + i * 7) % 120;
        lines.push(`${date};branch-${branch};${product};${amount}`);
      }
    }
  }
  return lines.join('\n');
}

export const handler = async (event: ExportEvent = {}): Promise<ExportResult> => {
  const days = Math.min(Math.max(event.days ?? 90, 1), 366);
  const csv = buildCsv(days);
  // gzip at the highest level plus SHA-256: CPU-heavy on purpose
  const zipped = gzipSync(csv, { level: 9 });
  const sha256 = createHash('sha256').update(zipped).digest('hex');
  return {
    rows: days * 40 * PRODUCTS.length,
    rawBytes: Buffer.byteLength(csv),
    gzipBytes: zipped.length,
    sha256,
  };
};
