// src/cli.ts
// Run locally: node src/cli.ts (uses your AWS profile and region)
import { scan } from './handler.ts';
import { formatReport } from './gaps.ts';

const gaps = await scan();
console.log(formatReport(gaps, process.env.AWS_REGION ?? 'eu-central-1'));
process.exitCode = gaps.some((g) => g.severity === 'high') ? 1 : 0;
