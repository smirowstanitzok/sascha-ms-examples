#!/usr/bin/env node
// Stop hook: Claude may only stop once the TypeScript type check is green.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();

// Already sent back once? Then don't run into an endless loop.
if (input.stop_hook_active === true) process.exit(0);
if (!existsSync(path.join(root, 'tsconfig.json'))) process.exit(0);

try {
  execFileSync('npx', ['--no-install', 'tsc', '--noEmit', '--pretty', 'false'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000,
  });
  process.exit(0);
} catch (err) {
  const output = `${err.stdout ?? ''}${err.stderr ?? ''}`.split('\n').filter(Boolean).slice(0, 30).join('\n');
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: `The type check fails. Please fix these errors before you report done:\n${output}`,
  }));
  process.exit(0);
}
