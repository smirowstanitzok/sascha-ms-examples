// src/bus-factor.ts
// Estimates the bus factor of a Git repository using the approach by
// Avelino et al. (2016): degree of authorship per file, then greedily
// remove the most important authors.
import { execFileSync } from "node:child_process";

const repo = process.argv[2] ?? ".";
const ignore = [/^dist\//, /^node_modules\//, /lock\.(json|yaml)$/, /\.min\.js$/];

function git(args: string[]): string {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
  });
}

type FileHistory = {
  firstAuthor: string;
  changes: Map<string, number>; // author -> number of commits to this file
};

// 1. Read the history: oldest commits first, follow renames.
const histories = new Map<string, FileHistory>();
let author = "";
const log = git(["log", "--reverse", "--no-merges", "-M", "--name-status", "--format=@@%aN"]);

for (const line of log.split("\n")) {
  if (line.startsWith("@@")) {
    author = line.slice(2).trim();
    continue;
  }
  if (!line.trim()) continue;
  const [status, ...paths] = line.split("\t");
  if (status.startsWith("R")) {
    const [from, to] = paths;
    const history = histories.get(from);
    if (history) {
      histories.delete(from);
      histories.set(to, history);
    }
  }
  const path = paths[paths.length - 1];
  if (status === "D") {
    histories.delete(path);
    continue;
  }
  let history = histories.get(path);
  if (!history) {
    history = { firstAuthor: author, changes: new Map() };
    histories.set(path, history);
  }
  history.changes.set(author, (history.changes.get(author) ?? 0) + 1);
}

// 2. Only consider files that still exist today.
const files = git(["ls-files"])
  .split("\n")
  .filter((f) => f && histories.has(f) && !ignore.some((re) => re.test(f)));

// 3. Compute the degree of authorship (DOA) and the authors per file.
function doa(history: FileHistory, dev: string): number {
  const fa = history.firstAuthor === dev ? 1 : 0;
  const dl = history.changes.get(dev) ?? 0;
  let ac = 0;
  for (const [other, count] of history.changes) if (other !== dev) ac += count;
  return 3.293 + 1.098 * fa + 0.164 * dl - 0.321 * Math.log(1 + ac);
}

const authorsOf = new Map<string, Set<string>>();
for (const file of files) {
  const history = histories.get(file)!;
  const devs = new Set([history.firstAuthor, ...history.changes.keys()]);
  const scores = [...devs].map((dev) => ({ dev, value: doa(history, dev) }));
  const max = Math.max(...scores.map((s) => s.value));
  const owners = scores
    .filter((s) => s.value / max > 0.75 && s.value >= 3.293)
    .map((s) => s.dev);
  authorsOf.set(file, new Set(owners));
}

// 4. Remove greedily until less than 50% of the files are covered.
function coverage(remaining: Set<string>): number {
  let covered = 0;
  for (const owners of authorsOf.values()) {
    if ([...owners].some((dev) => remaining.has(dev))) covered++;
  }
  return files.length === 0 ? 0 : covered / files.length;
}

const remaining = new Set([...authorsOf.values()].flatMap((owners) => [...owners]));
const removed: string[] = [];
while (remaining.size > 0 && coverage(remaining) >= 0.5) {
  const counts = new Map<string, number>();
  for (const owners of authorsOf.values()) {
    for (const dev of owners) {
      if (remaining.has(dev)) counts.set(dev, (counts.get(dev) ?? 0) + 1);
    }
  }
  const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  remaining.delete(top[0]);
  removed.push(`${top[0]} (${top[1]} files)`);
}

// 5. Knowledge silos: directories with many files only one person knows.
const islands = new Map<string, number>();
for (const [file, owners] of authorsOf) {
  if (owners.size !== 1) continue;
  const dir = file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : ".";
  islands.set(dir, (islands.get(dir) ?? 0) + 1);
}

console.log(`Files analysed: ${files.length}`);
console.log(`Bus factor: ${removed.length}`);
console.log(`Key people in this order: ${removed.join(", ") || "none"}`);
console.log("Directories with the most single-person files:");
for (const [dir, count] of [...islands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
  console.log(`  ${dir}: ${count}`);
}
