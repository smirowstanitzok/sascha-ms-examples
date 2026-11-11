// scripts/ts7-check.ts
import { readFileSync } from 'node:fs';

export interface Finding {
  option: string;
  problem: string;
  fix: string;
}

type Options = Record<string, unknown>;

/** Removes comments and trailing commas before closing brackets (tsconfig is JSONC). */
export function parseJsonc(text: string): unknown {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += next ?? '';
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
    } else {
      out += ch;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

const lower = (v: unknown) => (typeof v === 'string' ? v.toLowerCase() : v);

export function checkCompilerOptions(opts: Options, sourceDirs: string[] = []): Finding[] {
  const findings: Finding[] = [];
  const add = (option: string, problem: string, fix: string) => findings.push({ option, problem, fix });

  const resolution = lower(opts.moduleResolution);
  if (resolution === 'node' || resolution === 'node10' || resolution === 'classic') {
    add('moduleResolution', `"${String(opts.moduleResolution)}" no longer exists`, '"bundler" (with esbuild) or "nodenext" (with tsc output)');
  }
  const mod = lower(opts.module);
  if (['amd', 'umd', 'system', 'systemjs', 'none'].includes(String(mod))) {
    add('module', `"${String(opts.module)}" no longer exists`, '"preserve", "esnext" or "nodenext"');
  }
  if (lower(opts.target) === 'es5' || lower(opts.target) === 'es3') {
    add('target', 'ES5 is no longer a valid target', 'at least "ES2015", for Lambda preferably "ES2023"');
  }
  if ('baseUrl' in opts) {
    add('baseUrl', 'option was removed', 'write "paths" entries relative, starting with "./"');
  }
  const paths = (opts.paths ?? {}) as Record<string, string[]>;
  for (const [alias, targets] of Object.entries(paths)) {
    if (targets.some((t) => !t.startsWith('./') && !t.startsWith('../'))) {
      add(`paths["${alias}"]`, 'target without a leading "./"', 'e.g. "./src/shared/*" instead of "src/shared/*"');
    }
  }
  for (const flag of ['esModuleInterop', 'allowSyntheticDefaultImports', 'alwaysStrict']) {
    if (opts[flag] === false) add(flag, 'false is no longer allowed', 'delete the line');
  }
  if ('downlevelIteration' in opts) add('downlevelIteration', 'option was removed', 'delete the line');
  if ('outFile' in opts) add('outFile', 'option was removed', 'use a bundler such as esbuild');
  if ('ignoreDeprecations' in opts) {
    add('ignoreDeprecations', 'no longer helps in TypeScript 7', 'fix the actual causes');
  }
  if (!('types' in opts)) {
    add('types', 'default is now [] – @types packages are no longer loaded automatically', '"types": ["node"] (plus e.g. "jest")');
  }
  if (!('rootDir' in opts) && !opts.noEmit && sourceDirs.length === 1) {
    add('rootDir', 'default is now the tsconfig folder', `"rootDir": "./${sourceDirs[0]}"`);
  }
  return findings;
}

function sourceDirsOf(config: { include?: string[] }): string[] {
  const dirs = (config.include ?? []).map((p) => p.split('/')[0]).filter((d) => d && !d.includes('*'));
  return [...new Set(dirs)];
}

if (process.argv[1]?.endsWith('ts7-check.ts')) {
  const file = process.argv[2] ?? 'tsconfig.json';
  const config = parseJsonc(readFileSync(file, 'utf8')) as { compilerOptions?: Options; include?: string[] };
  const findings = checkCompilerOptions(config.compilerOptions ?? {}, sourceDirsOf(config));
  if (findings.length === 0) {
    console.log(`${file}: no known TypeScript 7 pitfalls found.`);
  } else {
    console.log(`${file}: ${findings.length} item(s) to fix before moving to TypeScript 7:`);
    for (const f of findings) console.log(`- ${f.option}: ${f.problem} → ${f.fix}`);
    process.exitCode = 1;
  }
}
