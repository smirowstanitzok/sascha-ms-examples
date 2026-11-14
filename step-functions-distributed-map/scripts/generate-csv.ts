// scripts/generate-csv.ts
// Generates a test CSV with semicolons as delimiter (like many Excel exports)
import { writeFileSync } from 'node:fs';

const rows = Number(process.argv[2] ?? 20000);

function isbnWithCheckDigit(n: number): string {
  const base = `978${String(n).padStart(9, '0')}`;
  const sum = base.split('').reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return base + ((10 - (sum % 10)) % 10);
}

const lines = ['isbn;title;author;year;copies'];
for (let i = 1; i <= rows; i++) {
  // Every 1000th row is broken on purpose so you can see the error handling
  const isbn = i % 1000 === 0 ? '123' : isbnWithCheckDigit(i);
  lines.push(`${isbn};Test book ${i};Author ${i % 97};${1950 + (i % 75)};${i % 5}`);
}

writeFileSync('katalog.csv', lines.join('\n') + '\n');
console.log(`wrote katalog.csv with ${rows} rows`);
