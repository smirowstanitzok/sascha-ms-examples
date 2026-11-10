// src/cli.ts
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { addWorkdays, dailyThroughput, percentile, simulateHowMany, simulateWhen } from './monte-carlo.ts';

const { values } = parseArgs({
  options: {
    file: { type: 'string', default: 'data/finished.csv' },
    from: { type: 'string' },
    to: { type: 'string' },
    remaining: { type: 'string', default: '25' },
    start: { type: 'string' },
    workdays: { type: 'string', default: '10' },
  },
});

// CSV with header "ticket,finished" – one line per finished ticket
const finished = readFileSync(values.file!, 'utf8')
  .trim()
  .split('\n')
  .slice(1)
  .map((line) => line.split(',')[1].trim());

const from = values.from ?? [...finished].sort()[0];
const to = values.to ?? [...finished].sort().at(-1)!;
const start = values.start ?? to;
const samples = dailyThroughput(finished, from, to);
const remaining = Number(values.remaining);
const workdays = Number(values.workdays);

console.log(`History: ${from} to ${to}, ${samples.length} workdays, ${finished.length} tickets finished`);

const when = simulateWhen(samples, remaining);
console.log(`\nWhen will ${remaining} tickets be done? (start: ${start})`);
for (const p of [50, 70, 85, 95]) {
  const days = percentile(when, p);
  console.log(`  ${p}% confidence: by ${addWorkdays(start, days)} (${days} workdays)`);
}

const howMany = simulateHowMany(samples, workdays);
console.log(`\nHow many tickets in ${workdays} workdays?`);
for (const p of [50, 70, 85, 95]) {
  // “At least X with p% confidence” = the (100 - p)th percentile
  console.log(`  ${p}% confidence: at least ${percentile(howMany, 100 - p)} tickets`);
}
