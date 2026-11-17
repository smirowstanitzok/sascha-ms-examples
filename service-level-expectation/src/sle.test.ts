// src/sle.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { ageStatus, buildReport, elapsedDays, parseCsv, percentile } from "./sle.ts";

test("finished on the same day counts as 1 day", () => {
  assert.equal(elapsedDays("2026-10-05", "2026-10-05"), 1);
  assert.equal(elapsedDays("2026-10-05", "2026-10-09"), 5);
});

test("end before start throws an error", () => {
  assert.throws(() => elapsedDays("2026-10-09", "2026-10-05"), /Invalid period/);
});

test("nearest-rank percentile always returns a real data value", () => {
  const values = [1, 2, 2, 3, 4, 5, 6, 8, 11, 20];
  assert.equal(percentile(values, 50), 4);
  assert.equal(percentile(values, 85), 11);
  assert.equal(percentile(values, 100), 20);
});

test("report only includes tickets finished since the cutoff date", () => {
  const csv = "id,start,end\nA-1,2026-10-01,2026-10-03\nA-2,2026-10-02,\nA-3,2026-09-01,2026-09-20";
  const report = buildReport(parseCsv(csv), "2026-10-01");
  assert.equal(report.finished, 1);
  assert.deepEqual(report.cycleTimes, [3]);
});

test("traffic light classifies the age of open tickets", () => {
  const r = { finished: 40, cycleTimes: [], p50: 3, p70: 5, p85: 8, p95: 13 };
  assert.equal(ageStatus(2, r), "on track");
  assert.equal(ageStatus(4, r), "watch");
  assert.equal(ageStatus(7, r), "critical");
  assert.equal(ageStatus(9, r), "over SLE");
});
