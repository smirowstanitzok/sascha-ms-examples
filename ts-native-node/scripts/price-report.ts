// scripts/price-report.ts
import { readFile } from 'node:fs/promises';
import { formatEuro, type Rental } from '#src/pricing.ts';
import { RentalBook } from '#src/rental-book.ts';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/price-report.ts <file.json>');
  process.exit(1);
}

const rentals = JSON.parse(await readFile(file, 'utf8')) as Rental[];
const book = new RentalBook();
rentals.forEach((r) => book.add(r));

for (const [bike, cent] of book.byBikeType()) {
  console.log(`${bike.padEnd(6)} ${formatEuro(cent).padStart(10)}`);
}
console.log(`total  ${formatEuro(book.totalInCent()).padStart(10)}`);
