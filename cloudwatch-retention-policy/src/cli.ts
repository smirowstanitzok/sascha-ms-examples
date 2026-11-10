// src/cli.ts
// Usage:
//   npx tsx src/cli.ts inventory
//   npx tsx src/cli.ts plan  --name baseline --days 90 [--prefix /aws/lambda] [--mode RETROACTIVE]
//   npx tsx src/cli.ts apply --name baseline --days 90 [--prefix /aws/lambda] [--mode RETROACTIVE] --yes
import {
  CloudWatchLogsClient,
  DescribeAccountPoliciesCommand,
  PutAccountPolicyCommand,
  paginateDescribeLogGroups,
} from "@aws-sdk/client-cloudwatch-logs";
import { parseArgs } from "node:util";
import {
  buildPolicyDocument,
  buildSelectionCriteria,
  formatBytes,
  parsePolicy,
  parseRetention,
  planChange,
  summarize,
  type EnforcementMode,
  type LogGroupInfo,
  type RetentionPolicy,
} from "./retention.js";

const client = new CloudWatchLogsClient({});

async function loadLogGroups(): Promise<LogGroupInfo[]> {
  const groups: LogGroupInfo[] = [];
  for await (const page of paginateDescribeLogGroups({ client }, {})) {
    for (const g of page.logGroups ?? []) {
      groups.push({
        name: g.logGroupName ?? "",
        // If an account policy already applies, retentionInDays shows the policy value.
        // For the "before" state we only need the effective value, so that is fine.
        retentionInDays: g.retentionInDays,
        creationTime: g.creationTime ?? 0,
        storedBytes: g.storedBytes ?? 0,
      });
    }
  }
  return groups;
}

async function loadPolicies(): Promise<RetentionPolicy[]> {
  const res = await client.send(
    new DescribeAccountPoliciesCommand({ policyType: "RETENTION_POLICY" }),
  );
  return (res.accountPolicies ?? []).map(parsePolicy);
}

async function inventory(): Promise<void> {
  const groups = await loadLogGroups();
  const forever = groups.filter((g) => g.retentionInDays === undefined);
  const bytes = forever.reduce((sum, g) => sum + g.storedBytes, 0);
  console.log(`Log groups: ${groups.length}, never expire: ${forever.length} (${formatBytes(bytes)})`);
  for (const g of forever.sort((a, b) => b.storedBytes - a.storedBytes).slice(0, 15)) {
    console.log(`  ${formatBytes(g.storedBytes).padStart(10)}  ${g.name}`);
  }
}

function readCandidate(values: Record<string, string | boolean | undefined>): RetentionPolicy {
  if (typeof values.name !== "string" || typeof values.days !== "string") {
    throw new Error("--name and --days are required.");
  }
  const mode = (values.mode ?? "RETROACTIVE") as EnforcementMode;
  if (mode !== "RETROACTIVE" && mode !== "NEW_ONLY") {
    throw new Error("--mode must be RETROACTIVE or NEW_ONLY.");
  }
  return {
    name: values.name,
    prefix: typeof values.prefix === "string" ? values.prefix : undefined,
    retention: parseRetention(values.days),
    mode,
    createdAt: Date.now(),
  };
}

async function sendPolicy(candidate: RetentionPolicy, dryRun: boolean) {
  return client.send(
    new PutAccountPolicyCommand({
      policyName: candidate.name,
      policyType: "RETENTION_POLICY",
      policyDocument: buildPolicyDocument(candidate.retention, candidate.mode),
      selectionCriteria: buildSelectionCriteria(candidate.prefix),
      dryRun,
    }),
  );
}

async function plan(candidate: RetentionPolicy): Promise<number> {
  const [groups, existing] = await Promise.all([loadLogGroups(), loadPolicies()]);
  const changes = planChange(groups, existing, candidate);
  const summary = summarize(changes);
  console.log(`Local plan: ${summary.shorter} shorter, ${summary.longer} longer, ${summary.unchanged} unchanged`);
  for (const c of changes.filter((x) => x.kind === "shorter")) {
    console.log(`  SHORTER ${String(c.before).padStart(12)} -> ${String(c.after).padEnd(12)} ${formatBytes(c.group.storedBytes).padStart(10)}  ${c.group.name}`);
  }

  // Second opinion straight from CloudWatch Logs (counts + top 20 by size).
  const res = await sendPolicy(candidate, true);
  const dry = res.dryRunResult;
  console.log(
    `Dry run (AWS): matched ${dry?.totalMatchedLogGroups ?? 0}, ` +
      `shorter ${dry?.decreasedRetentionLogGroupCount ?? 0}, ` +
      `longer ${dry?.increasedRetentionLogGroupCount ?? 0}, ` +
      `unchanged ${dry?.unchangedRetentionLogGroupCount ?? 0}, ` +
      `not analyzed ${dry?.failedAnalysisCount ?? 0}`,
  );
  return summary.shorter;
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      name: { type: "string" },
      days: { type: "string" },
      prefix: { type: "string" },
      mode: { type: "string" },
      yes: { type: "boolean", default: false },
    },
  });
  const command = positionals[0];

  if (command === "inventory") return inventory();

  const candidate = readCandidate(values);
  const shorter = await plan(candidate);
  if (command === "plan") return;

  if (command === "apply") {
    if (!values.yes) {
      console.log("Nothing changed. Add --yes to create the policy.");
      return;
    }
    if (shorter > 0) {
      console.log(`Warning: ${shorter} log groups will keep less data than today.`);
    }
    await sendPolicy(candidate, false);
    console.log(`Policy "${candidate.name}" saved. It takes effect in about 24 hours.`);
    return;
  }

  throw new Error(`Unknown command "${command}". Use inventory, plan or apply.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
