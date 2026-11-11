// test/ts7-check.test.ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkCompilerOptions, parseJsonc } from '../scripts/ts7-check';

const load = (file: string) =>
  parseJsonc(readFileSync(new URL(file, import.meta.url), 'utf8')) as {
    compilerOptions: Record<string, unknown>;
  };

describe('ts7-check', () => {
  it('finds the pitfalls in the old tsconfig', () => {
    const { compilerOptions } = load('../examples/tsconfig.before.json');
    const options = checkCompilerOptions(compilerOptions, ['src']).map((f) => f.option);
    expect(options).toEqual(
      expect.arrayContaining(['moduleResolution', 'baseUrl', 'paths["@shared/*"]', 'types', 'rootDir']),
    );
  });

  it('reports nothing for the new tsconfig', () => {
    const { compilerOptions } = load('../tsconfig.json');
    expect(checkCompilerOptions(compilerOptions)).toEqual([]);
  });

  it('understands comments and trailing commas', () => {
    expect(parseJsonc('{ "a": "http://x", /* b */ "c": [1, 2,], }')).toEqual({ a: 'http://x', c: [1, 2] });
  });
});
