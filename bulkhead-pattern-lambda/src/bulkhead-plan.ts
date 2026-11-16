// src/bulkhead-plan.ts
// Checks a bulkhead plan before you deploy it: one worker function per partner,
// each with reserved concurrency and a maximum concurrency on its SQS trigger.

export interface PartnerBulkhead {
  name: string;
  /** How many parallel requests the partner accepts (from its docs or contract). */
  partnerLimit: number;
  /** Reserved concurrency of the worker function (guarantee and upper limit). */
  reservedConcurrency: number;
  /** MaximumConcurrency of the SQS event source mapping (2 to 1000). */
  maxConcurrency: number;
}

export interface PlanResult {
  ok: boolean;
  problems: string[];
  warnings: string[];
  /** Concurrency left for all functions without a reservation. */
  unreservedLeft: number;
}

const ALWAYS_UNRESERVED = 100; // Lambda always keeps 100 units unreserved

export function checkPlan(
  accountLimit: number,
  bulkheads: PartnerBulkhead[],
  otherReserved = 0,
): PlanResult {
  const problems: string[] = [];
  const warnings: string[] = [];

  for (const b of bulkheads) {
    if (b.maxConcurrency < 2 || b.maxConcurrency > 1000) {
      problems.push(`${b.name}: maxConcurrency must be between 2 and 1000`);
    }
    if (b.maxConcurrency > b.reservedConcurrency) {
      problems.push(`${b.name}: maxConcurrency (${b.maxConcurrency}) is higher than reservedConcurrency (${b.reservedConcurrency}), Lambda will throttle`);
    }
    if (b.maxConcurrency > b.partnerLimit) {
      problems.push(`${b.name}: maxConcurrency (${b.maxConcurrency}) exceeds the partner limit (${b.partnerLimit})`);
    }
    if (b.reservedConcurrency < 5) {
      warnings.push(`${b.name}: AWS recommends at least 5 reserved concurrency for SQS triggers`);
    }
  }

  const reserved = otherReserved + bulkheads.reduce((sum, b) => sum + b.reservedConcurrency, 0);
  const maxReservable = Math.max(0, accountLimit - ALWAYS_UNRESERVED);
  if (reserved > maxReservable) {
    problems.push(`reserved concurrency in total (${reserved}) exceeds the reservable maximum (${maxReservable})`);
  }

  const unreservedLeft = accountLimit - reserved;
  if (unreservedLeft < accountLimit * 0.5) {
    warnings.push(`only ${unreservedLeft} of ${accountLimit} remain for functions without a reservation`);
  }

  return { ok: problems.length === 0, problems, warnings, unreservedLeft };
}
