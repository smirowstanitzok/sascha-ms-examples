// scripts/freeze-check.ts
import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export interface FreezeWindow {
  name: string;
  start: string; // ISO timestamp with offset, e.g. 2026-12-21T00:00:00+01:00
  end: string;
  allowedReasons: string[];
}

export interface FreezeConfig {
  windows: FreezeWindow[];
}

export interface Override {
  reason: string;
  note: string;
}

export type FreezeDecision =
  | { status: "open" }
  | { status: "blocked"; window: FreezeWindow; message: string }
  | { status: "override"; window: FreezeWindow; reason: string; note: string };

const MIN_NOTE_LENGTH = 20;

export function parseConfig(json: string): FreezeConfig {
  const data = JSON.parse(json) as FreezeConfig;
  if (!Array.isArray(data.windows)) {
    throw new Error("freeze.json: field 'windows' is missing or not a list");
  }
  for (const w of data.windows) {
    const start = Date.parse(w.start);
    const end = Date.parse(w.end);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      throw new Error(`freeze.json: Invalid date in window '${w.name}'`);
    }
    if (start >= end) {
      throw new Error(`freeze.json: start is not before end ('${w.name}')`);
    }
  }
  return data;
}

export function findActiveWindow(config: FreezeConfig, now: Date): FreezeWindow | undefined {
  const t = now.getTime();
  return config.windows.find((w) => t >= Date.parse(w.start) && t < Date.parse(w.end));
}

export function decide(config: FreezeConfig, now: Date, override?: Override): FreezeDecision {
  const window = findActiveWindow(config, now);
  if (!window) {
    return { status: "open" };
  }
  const reason = override?.reason.trim() ?? "";
  const note = override?.note.trim() ?? "";
  if (reason === "" || reason === "none") {
    return {
      status: "blocked",
      window,
      message: `Change Freeze '${window.name}' active until ${window.end}. Deployment stopped.`,
    };
  }
  if (!window.allowedReasons.includes(reason)) {
    return {
      status: "blocked",
      window,
      message: `Reason '${reason}' is not allowed during the freeze. Allowed: ${window.allowedReasons.join(", ")}.`,
    };
  }
  if (note.length < MIN_NOTE_LENGTH) {
    return {
      status: "blocked",
      window,
      message: `Please provide a justification with at least ${MIN_NOTE_LENGTH} characters.`,
    };
  }
  return { status: "override", window, reason, note };
}

function main(): void {
  const configPath = process.env.FREEZE_CONFIG ?? "freeze.json";
  const now = process.env.FREEZE_NOW ? new Date(process.env.FREEZE_NOW) : new Date();
  const config = parseConfig(readFileSync(configPath, "utf8"));
  const decision = decide(config, now, {
    reason: process.env.OVERRIDE_REASON ?? "",
    note: process.env.OVERRIDE_NOTE ?? "",
  });

  const summary = process.env.GITHUB_STEP_SUMMARY;
  const report = (text: string) => {
    console.log(text);
    if (summary) appendFileSync(summary, `${text}\n`);
  };

  switch (decision.status) {
    case "open":
      report("No change freeze active. Deployment allowed.");
      break;
    case "override":
      report(
        `⚠️ Exception during change freeze '${decision.window.name}': ${decision.reason} – ${decision.note}`,
      );
      break;
    case "blocked":
      report(`⛔ ${decision.message}`);
      process.exitCode = 1;
      break;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
