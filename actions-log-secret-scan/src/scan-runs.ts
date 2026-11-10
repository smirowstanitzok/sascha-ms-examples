// src/scan-runs.ts
import { parseArgs } from "node:util";
import { scanLogArchive } from "./scan-zip.js";

const { values } = parseArgs({
  options: {
    repo: { type: "string" },
    days: { type: "string", default: "14" },
    max: { type: "string", default: "50" },
  },
});

const token = process.env.GITHUB_TOKEN;
if (!values.repo || !token) {
  console.error("Usage: GITHUB_TOKEN=... npm run scan -- --repo owner/name [--days 14] [--max 50]");
  process.exit(2);
}

const api = "https://api.github.com";
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

interface WorkflowRun {
  id: number;
  name: string;
  html_url: string;
  created_at: string;
}

async function listRuns(repo: string, days: number, max: number): Promise<WorkflowRun[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const query = new URLSearchParams({ status: "completed", per_page: String(Math.min(max, 100)), created: `>=${since}` });
  const res = await fetch(`${api}/repos/${repo}/actions/runs?${query}`, { headers });
  if (!res.ok) throw new Error(`Listing runs failed: HTTP ${res.status}`);
  const body = (await res.json()) as { workflow_runs: WorkflowRun[] };
  return body.workflow_runs.slice(0, max);
}

async function downloadLogs(repo: string, runId: number): Promise<Uint8Array | undefined> {
  // GitHub answers with 302 and a download link that is valid for one minute; fetch follows it.
  const res = await fetch(`${api}/repos/${repo}/actions/runs/${runId}/logs`, { headers });
  if (res.status === 404 || res.status === 410) return undefined; // logs expired or deleted
  if (!res.ok) throw new Error(`Log download for run ${runId} failed: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

const runs = await listRuns(values.repo, Number(values.days), Number(values.max));
console.log(`Checking ${runs.length} workflow runs in ${values.repo} …`);

let total = 0;
for (const run of runs) {
  const zip = await downloadLogs(values.repo, run.id);
  if (!zip) continue;
  const findings = scanLogArchive(zip);
  if (findings.length === 0) continue;
  total += findings.length;
  console.log(`\n${run.name} (#${run.id}, ${run.created_at})\n${run.html_url}`);
  for (const f of findings) {
    console.log(`  [${f.rule}] ${f.file}:${f.line}  ${f.preview}`);
  }
}

if (total > 0) {
  console.log(`\n${total} possible secrets found. Rotate first, then delete the logs.`);
  process.exit(1);
}
console.log("No suspicious values found.");
