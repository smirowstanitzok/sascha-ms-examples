// test/freeze-check.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { decide, parseConfig } from "../scripts/freeze-check.ts";

const config = parseConfig(
  JSON.stringify({
    windows: [
      {
        name: "Year end",
        start: "2026-12-21T00:00:00+01:00",
        end: "2027-01-04T09:00:00+01:00",
        allowedReasons: ["hotfix", "security"],
      },
    ],
  }),
);

test("deployment is allowed outside the window", () => {
  const d = decide(config, new Date("2026-12-18T15:00:00+01:00"));
  assert.equal(d.status, "open");
});

test("deployment is blocked inside the window without an exception", () => {
  const d = decide(config, new Date("2026-12-27T10:00:00+01:00"));
  assert.equal(d.status, "blocked");
});

test("the end of the window is no longer part of the freeze", () => {
  const d = decide(config, new Date("2027-01-04T09:00:00+01:00"));
  assert.equal(d.status, "open");
});

test("a hotfix with a justification is allowed", () => {
  const d = decide(config, new Date("2026-12-27T10:00:00+01:00"), {
    reason: "hotfix",
    note: "Bookings are failing, fix for ticket RAD-42",
  });
  assert.equal(d.status, "override");
});

test("an unknown reason is rejected", () => {
  const d = decide(config, new Date("2026-12-27T10:00:00+01:00"), {
    reason: "feature",
    note: "New discount campaign should go live before New Year",
  });
  assert.equal(d.status, "blocked");
  if (d.status === "blocked") assert.match(d.message, /not allowed/);
});

test("a justification that is too short is rejected", () => {
  const d = decide(config, new Date("2026-12-27T10:00:00+01:00"), {
    reason: "security",
    note: "urgent",
  });
  assert.equal(d.status, "blocked");
});

test("start after end is a configuration error", () => {
  assert.throws(() =>
    parseConfig(
      JSON.stringify({
        windows: [{ name: "broken", start: "2027-01-04T00:00:00Z", end: "2026-12-21T00:00:00Z", allowedReasons: [] }],
      }),
    ),
  );
});
