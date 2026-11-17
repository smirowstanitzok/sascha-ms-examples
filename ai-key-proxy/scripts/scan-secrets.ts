// scripts/scan-secrets.ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

export interface Finding {
  file: string;
  kind: string;
  excerpt: string;
}

/** Patterns for typical keys. Deliberately narrow to keep false positives rare. */
export const PATTERNS: { kind: string; regex: RegExp }[] = [
  { kind: 'Anthropic API key', regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { kind: 'OpenAI API key', regex: /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/g },
  { kind: 'AWS access key ID', regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { kind: 'Google API key', regex: /AIza[0-9A-Za-z_-]{35}/g },
];

const CHECK = new Set(['.js', '.mjs', '.cjs', '.map', '.html', '.json', '.txt', '.env']);

/** Shortens the finding so the key does not end up in the CI log. */
export function mask(value: string): string {
  return `${value.slice(0, 6)}…(${value.length} chars)`;
}

export function checkText(file: string, content: string): Finding[] {
  const findings: Finding[] = [];
  for (const { kind, regex } of PATTERNS) {
    for (const match of content.matchAll(regex)) {
      // No duplicate finding when a key matches several patterns (e.g. sk-ant- and sk-)
      if (findings.some((f) => f.file === file && f.excerpt === mask(match[0]))) continue;
      findings.push({ file, kind, excerpt: mask(match[0]) });
    }
  }
  return findings;
}

export function checkDirectory(root: string): { findings: Finding[]; sourceMaps: string[] } {
  const findings: Finding[] = [];
  const sourceMaps: string[] = [];
  const walk = (path: string) => {
    for (const name of readdirSync(path)) {
      const full = join(path, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      const ext = name.startsWith('.env') ? '.env' : extname(name);
      if (ext === '.map') sourceMaps.push(full);
      if (CHECK.has(ext)) findings.push(...checkText(full, readFileSync(full, 'utf8')));
    }
  };
  walk(root);
  return { findings, sourceMaps };
}

// Usage: npx tsx scripts/scan-secrets.ts dist
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] ?? 'dist';
  const { findings, sourceMaps } = checkDirectory(root);
  for (const map of sourceMaps) console.warn(`Warning: source map is shipped: ${map}`);
  for (const f of findings) console.error(`Finding: ${f.kind} in ${f.file}: ${f.excerpt}`);
  if (findings.length > 0) {
    console.error(`${findings.length} possible keys found. Build aborted.`);
    process.exit(1);
  }
  console.log(`No keys found in ${root}.`);
}
