// test/package-stages.ts
import { execFileSync } from 'node:child_process';

export const STAGES = ['dev', 'prod'] as const;

// Vitest calls this function once before all tests.
export default function setup(): void {
  const cli = process.env.SLS_CLI ?? 'serverless';
  for (const stage of STAGES) {
    execFileSync('npx', [cli, 'package', '--stage', stage, '--package', `.serverless-${stage}`], {
      stdio: 'inherit',
    });
  }
}
