// src/validate-row.ts
// Validates a CSV row from the catalog export and turns it into a record.
// Step Functions delivers each row as an object with string values.

export interface RawRow {
  isbn?: string;
  title?: string;
  author?: string;
  year?: string;
  copies?: string;
}

export interface Book {
  isbn: string;
  title: string;
  author: string;
  year: number;
  copies: number;
}

export type ValidationResult =
  | { ok: true; book: Book }
  | { ok: false; reason: string };

// ISBN-13: strip hyphens and spaces, then verify the check digit
export function normalizeIsbn(value: string): string | null {
  const digits = value.replace(/[-\s]/g, '');
  if (!/^97[89]\d{10}$/.test(digits)) return null;

  const sum = digits
    .slice(0, 12)
    .split('')
    .reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[12]) ? digits : null;
}

export function validateRow(row: RawRow, currentYear = new Date().getFullYear()): ValidationResult {
  const isbn = normalizeIsbn(row.isbn ?? '');
  if (!isbn) return { ok: false, reason: 'invalid ISBN' };

  const title = (row.title ?? '').trim();
  if (title.length === 0) return { ok: false, reason: 'missing title' };

  const year = Number(row.year);
  if (!Number.isInteger(year) || year < 1450 || year > currentYear + 1) {
    return { ok: false, reason: 'implausible publication year' };
  }

  const copies = Number(row.copies);
  if (!Number.isInteger(copies) || copies < 0) {
    return { ok: false, reason: 'copies is not a number ≥ 0' };
  }

  return {
    ok: true,
    book: { isbn, title, author: (row.author ?? '').trim(), year, copies },
  };
}
