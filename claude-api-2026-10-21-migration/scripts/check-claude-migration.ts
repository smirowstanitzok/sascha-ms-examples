// scripts/check-claude-migration.ts
// Finds places that can break with API version 2026-10-21 or SDK 1.x.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = process.argv[2] ?? '.';
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.yaml', '.yml']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'cdk.out', '.git']);

const CHECKS: { name: string; pattern: RegExp; hint: string }[] = [
  {
    name: 'Sampling parameters',
    pattern: /\b(temperature|top_p|top_k|topP|topK)\b/,
    hint: 'Remove – with 2026-10-21 the API responds with HTTP 400.',
  },
  {
    name: 'X-Api-Key',
    pattern: /x-api-key/i,
    hint: 'SDK 1.x sends Authorization: Bearer – check proxy/gateway.',
  },
  {
    name: 'Text Completions',
    pattern: /\.completions\.create\(/,
    hint: 'Switch to client.messages.create.',
  },
  {
    name: 'compactionControl',
    pattern: /compactionControl/,
    hint: 'Replace with context_management using compact_20260112.',
  },
  {
    name: 'betas on models',
    pattern: /\bmodels\.(list|retrieve)\([^)]*betas/,
    hint: 'Use client.beta.models.',
  },
];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (EXTENSIONS.has(extname(path))) yield path;
  }
}

let findings = 0;
for (const file of walk(ROOT)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const check of CHECKS) {
      if (check.pattern.test(line)) {
        findings++;
        console.log(`${file}:${index + 1}  [${check.name}]  ${line.trim()}`);
        console.log(`   → ${check.hint}`);
      }
    }
  });
}

console.log(findings === 0 ? 'No findings.' : `${findings} finding(s) to check.`);
process.exitCode = findings === 0 ? 0 : 1;
