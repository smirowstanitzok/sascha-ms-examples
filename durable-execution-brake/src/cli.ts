// src/cli.ts
import { parseArgs } from "node:util";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { pauseAll, purgeFinished, resumeAll, summarize, type ExecutionResult } from "./brake.ts";

const usage = `Usage:
  npm run brake -- pause  <function> --reason "<text>" [--qualifier live] [--dry-run] [--keep-timeout]
  npm run brake -- resume <function> --reason "<text>" [--qualifier live] [--dry-run]
  npm run brake -- purge  <function> --before 2026-10-01 [--qualifier live] [--yes]`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    reason: { type: "string" },
    qualifier: { type: "string" },
    before: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "keep-timeout": { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
  },
});

const [command, functionName] = positionals;
if (!command || !functionName) {
  console.error(usage);
  process.exit(1);
}

// Retries with backoff for throttling (TooManyRequestsException) come from the SDK.
const client = new LambdaClient({ maxAttempts: 6 });
const target = { functionName, qualifier: values.qualifier };

function requireReason() {
  if (!values.reason) {
    console.error("Please provide --reason. It ends up in the execution history.");
    process.exit(1);
  }
  return values.reason;
}

let results: ExecutionResult[];
switch (command) {
  case "pause":
    results = await pauseAll(client, target, {
      reason: requireReason(),
      dryRun: values["dry-run"],
      keepTimeoutRunning: values["keep-timeout"],
    });
    break;
  case "resume":
    results = await resumeAll(client, target, { reason: requireReason(), dryRun: values["dry-run"] });
    break;
  case "purge": {
    const before = new Date(values.before ?? "");
    if (Number.isNaN(before.getTime())) {
      console.error("Please provide --before as a date, e.g. 2026-10-01.");
      process.exit(1);
    }
    results = await purgeFinished(client, target, { startedBefore: before, confirm: values.yes });
    break;
  }
  default:
    console.error(usage);
    process.exit(1);
}

for (const r of results) {
  console.log(`${r.outcome.padEnd(8)} ${r.name}${r.detail ? ` (${r.detail})` : ""}`);
}
console.log("Summary:", summarize(results));
if (results.some((r) => r.outcome === "failed")) process.exit(2);
