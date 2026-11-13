// tools/snapshot-check.ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type Finding = { file: string; line: number; rule: string; hint: string };

const rules: { id: string; pattern: RegExp; hint: string }[] = [
  { id: 'node-crypto-random', pattern: /\b(randomUUID|randomBytes|randomInt|getRandomValues)\s*\(/, hint: 'Can repeat across restored instances, read /dev/urandom instead' },
  { id: 'uuid-package', pattern: /from\s+['"]uuid['"]/, hint: 'The uuid package uses node:crypto, use freshId()' },
  { id: 'math-random', pattern: /Math\.random\s*\(/, hint: 'Seeded state ends up in the snapshot' },
  { id: 'hostname-pid', pattern: /\b(os\.hostname\s*\(|hostname\s*\(\)|process\.pid)\b/, hint: 'Identical on every restored instance' },
];

// Only top-level lines (no indentation) count for time values
const topLevelTime = /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(Date\.now\(\)|new Date\(\)|performance\.now\(\))/;

export function checkSource(file: string, source: string): Finding[] {
  const findings: Finding[] = [];
  source.split('\n').forEach((text, i) => {
    const line = i + 1;
    if (text.trim().startsWith('//')) return;
    for (const r of rules) {
      if (r.pattern.test(text)) findings.push({ file, line, rule: r.id, hint: r.hint });
    }
    if (topLevelTime.test(text)) {
      findings.push({ file, line, rule: 'startup-time', hint: 'Timestamp is frozen at snapshot time, compute it in the handler' });
    }
  });
  return findings;
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (name === 'node_modules' || name === 'dist') return [];
    if (statSync(full).isDirectory()) return listFiles(full);
    return /\.(ts|js|mjs)$/.test(name) ? [full] : [];
  });
}

if (process.argv[1]?.endsWith('snapshot-check.ts')) {
  const dir = process.argv[2] ?? 'agent/src';
  const findings = listFiles(dir).flatMap((f) => checkSource(f, readFileSync(f, 'utf8')));
  for (const f of findings) console.log(`${f.file}:${f.line}  [${f.rule}]  ${f.hint}`);
  console.log(findings.length === 0 ? 'No snapshot risks found.' : `${findings.length} finding(s).`);
  process.exitCode = findings.length === 0 ? 0 : 1;
}
