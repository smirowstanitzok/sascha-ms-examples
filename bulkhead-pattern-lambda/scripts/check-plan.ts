// scripts/check-plan.ts
import { checkPlan, type PartnerBulkhead } from '../src/bulkhead-plan.ts';

// Must match serverless.yml
const plan: PartnerBulkhead[] = [
  { name: 'payment', partnerLimit: 20, reservedConcurrency: 12, maxConcurrency: 10 },
  { name: 'lock', partnerLimit: 10, reservedConcurrency: 8, maxConcurrency: 6 },
  { name: 'sms', partnerLimit: 5, reservedConcurrency: 5, maxConcurrency: 4 },
];

const accountLimit = Number(process.argv[2] ?? 1000);
const result = checkPlan(accountLimit, plan);

console.log(`account limit: ${accountLimit}, left for everything else: ${result.unreservedLeft}`);
for (const p of result.problems) console.log(`PROBLEM  ${p}`);
for (const w of result.warnings) console.log(`WARNING  ${w}`);
console.log(result.ok ? 'plan ok' : 'plan not ok');
process.exitCode = result.ok ? 0 : 1;
