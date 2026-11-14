// test/validate-row.test.ts
import { describe, expect, it } from 'vitest';
import { normalizeIsbn, validateRow } from '../src/validate-row.js';

describe('normalizeIsbn', () => {
  it('accepts a valid ISBN-13 with hyphens', () => {
    expect(normalizeIsbn('978-3-16-148410-0')).toBe('9783161484100');
  });

  it('rejects a wrong check digit', () => {
    expect(normalizeIsbn('9783161484101')).toBeNull();
  });
});

describe('validateRow', () => {
  const row = { isbn: '9783161484100', title: 'Cooking for Beginners', author: 'A. Example', year: '2021', copies: '3' };

  it('turns a clean row into a record', () => {
    const result = validateRow(row, 2026);
    expect(result).toEqual({
      ok: true,
      book: { isbn: '9783161484100', title: 'Cooking for Beginners', author: 'A. Example', year: 2021, copies: 3 },
    });
  });

  it('reports a missing title', () => {
    expect(validateRow({ ...row, title: '  ' }, 2026)).toEqual({ ok: false, reason: 'missing title' });
  });

  it('reports a publication year in the future', () => {
    const result = validateRow({ ...row, year: '2031' }, 2026);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/publication year/);
  });

  it('reports negative copies', () => {
    expect(validateRow({ ...row, copies: '-1' }, 2026).ok).toBe(false);
  });
});
