# Service level expectation: derive it from cycle time

Calculate a Kanban **service level expectation (SLE)** from your team's historical cycle time: nearest-rank percentiles (50/70/85/95), a work item age traffic light for open tickets and a simple cycle time scatterplot as SVG. The sample data comes from a fictional team building a bike rental app.

- Article (English): [Service level expectation: derive it from cycle time](https://sascha-ms.de/en/service-level-expectation)
- Article (German): [Service Level Expectation aus Cycle Time ableiten](https://sascha-ms.de/2026/3518-service-level-expectation)

## Files

| File | Purpose |
| --- | --- |
| `src/sle.ts` | Cycle time, nearest-rank percentiles, report and age traffic light |
| `src/cli.ts` | Reads the CSV, prints the SLE and open tickets, writes `scatterplot.svg` |
| `src/sle.test.ts` | Tests with the built-in Node.js test runner |
| `data/tickets.csv` | 54 fictional tickets (`id,start,end`, empty end = still open) |

## Run it

```bash
npm install
npm test
npm run typecheck
npx tsx src/cli.ts data/tickets.csv 2026-09-01 2026-11-17
```

Arguments: CSV file, optional cutoff date (only tickets finished on or after it), optional "today" date for work item age.

Expected: 48 finished tickets, 85th percentile = 8 days, suggested SLE "85% in 8 days or less".

## Tested with

Node.js 22, TypeScript 5.9, tsx 4.23 (type check and tests passed when the article was written).
