#!/usr/bin/env node
// PostToolUse hook for Edit and Write: formats the changed file with Prettier.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const FORMATTABLE = /\.(ts|tsx|js|mjs|cjs|json|md|ya?ml|css)$/;

const input = JSON.parse(readFileSync(0, 'utf8'));
const file = input.tool_input?.file_path;

if (file && FORMATTABLE.test(file)) {
  try {
    execFileSync('npx', ['--no-install', 'prettier', '--write', file], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 20_000 });
  } catch (err) {
    // Exit 1 = non-blocking error: Claude Code shows a hint, work continues.
    process.stderr.write(`Prettier failed for ${file}\n`);
    process.exit(1);
  }
}
process.exit(0);
