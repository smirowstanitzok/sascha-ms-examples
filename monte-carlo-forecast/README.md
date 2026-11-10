# Monte Carlo forecasting with throughput data

Forecast delivery dates from your team's daily throughput instead of story points. A small TypeScript script with no runtime dependencies answers two questions: *When will N tickets be done?* and *How many tickets can we finish in X workdays?*

- Article (English): https://sascha-ms.de/en/monte-carlo-forecasting-delivery-dates/
- Article (German): https://sascha-ms.de/2026/2610-monte-carlo-simulation-liefertermine/

## Files

| File | Purpose |
| --- | --- |
| `src/monte-carlo.ts` | Throughput per workday, both simulations, percentiles, workday calendar |
| `src/cli.ts` | Command line: reads the CSV and prints forecasts for 50/70/85/95% |
| `test/monte-carlo.test.ts` | Vitest tests (fixed seed, edge cases) |
| `data/finished.csv` | Fictional example data: one line per finished ticket |

## Run it

```bash
npm install
npm run typecheck
npm test
npm run forecast -- --from 2026-09-28 --to 2026-11-06 --start 2026-11-09 --remaining 25 --workdays 10
```

Replace `data/finished.csv` with an export from your ticket system (`ticket,finished` with dates as `YYYY-MM-DD`). Days without a finished ticket are counted as zero on purpose.

## Tested with

Node.js 22.23, TypeScript 5.9, tsx 4.23, Vitest 3.2
