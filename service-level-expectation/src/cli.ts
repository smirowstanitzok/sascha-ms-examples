// src/cli.ts
import { readFileSync, writeFileSync } from "node:fs";
import { buildReport, elapsedDays, openItems, parseCsv } from "./sle.ts";

const [file = "data/tickets.csv", since, todayArg] = process.argv.slice(2);
const today = todayArg ?? new Date().toISOString().slice(0, 10);
const tickets = parseCsv(readFileSync(file, "utf8"));
const report = buildReport(tickets, since);

console.log(`Finished tickets: ${report.finished}`);
if (report.finished < 30) {
  console.log("Note: with fewer than 30 data points the SLE is only a starting assumption.");
}
console.log(`50%: ${report.p50} days | 70%: ${report.p70} days`);
console.log(`85%: ${report.p85} days | 95%: ${report.p95} days`);
console.log(`Suggested SLE: 85% of our tickets are finished in ${report.p85} days or less.\n`);

console.log("Open tickets (work item age):");
for (const item of openItems(tickets, today, report)) {
  console.log(`  ${item.id.padEnd(8)} ${String(item.age).padStart(3)} days  ${item.status}`);
}

// Simple cycle time scatterplot as SVG: x = finish date, y = days
const done = tickets.filter((t) => t.end !== undefined && (!since || t.end >= since));
const W = 900, H = 420, PAD = 60;
const times = done.map((t) => Date.parse(t.end as string));
const minT = Math.min(...times), maxT = Math.max(...times);
const maxY = Math.max(...report.cycleTimes, report.p95) + 2;
const x = (t: number) => PAD + ((t - minT) / Math.max(maxT - minT, 1)) * (W - 2 * PAD);
const y = (d: number) => H - PAD - (d / maxY) * (H - 2 * PAD);

const dots = done
  .map((t) => {
    const d = elapsedDays(t.start, t.end as string);
    return `<circle cx="${x(Date.parse(t.end as string)).toFixed(1)}" cy="${y(d).toFixed(1)}" r="5" fill="#fbbf24"/>`;
  })
  .join("");
const line = (v: number, label: string, color: string) =>
  `<line x1="${PAD}" x2="${W - PAD}" y1="${y(v)}" y2="${y(v)}" stroke="${color}" stroke-dasharray="6 4"/>` +
  `<text x="${W - PAD + 4}" y="${y(v) + 5}" fill="${color}" font-size="14">${label}: ${v} d</text>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W + 60} ${H}" font-family="Arial">
<rect width="100%" height="100%" fill="#0b1224"/>
<line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" stroke="#94a3b8"/>
<line x1="${PAD}" y1="${PAD}" x2="${PAD}" y2="${H - PAD}" stroke="#94a3b8"/>
<text x="${PAD}" y="${PAD - 20}" fill="#e2e8f0" font-size="16">Cycle time in days per finished ticket</text>
${line(report.p50, "50%", "#94a3b8")}${line(report.p85, "85%", "#f97316")}${line(report.p95, "95%", "#ec4899")}
${dots}
</svg>`;
writeFileSync("scatterplot.svg", svg);
console.log("\nScatterplot saved: scatterplot.svg");
