// scripts/check-instructions.ts
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import picomatch from "picomatch";

export type Finding = { file: string; level: "error" | "warning"; message: string };

const ALLOWED_AGENTS = ["code-review", "cloud-agent"];
const SOFT_LIMIT = 4000; // own rule of thumb, not a GitHub limit
const IGNORED_DIRS = new Set([".git", "node_modules", "cdk.out", "dist", "coverage"]);

// Reads the frontmatter block between the first two "---" lines.
export function parseFrontmatter(text: string): Record<string, string> | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return null;
  const result: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z]+):\s*(.*)$/.exec(line.trim());
    if (pair) result[pair[1]] = pair[2].replace(/^["']|["']$/g, "");
  }
  return result;
}

// "a/**/*.ts, b/**/*.ts" becomes ["a/**/*.ts", "b/**/*.ts"]
export function splitPatterns(applyTo: string): string[] {
  return applyTo.split(",").map((p) => p.trim()).filter(Boolean);
}

export function checkInstructionFile(file: string, text: string, repoFiles: string[]): Finding[] {
  const findings: Finding[] = [];
  const fm = parseFrontmatter(text);
  if (!fm) {
    return [{ file, level: "error", message: "frontmatter block is missing" }];
  }
  if (!fm.applyTo) {
    findings.push({ file, level: "error", message: "applyTo is missing" });
  } else {
    for (const pattern of splitPatterns(fm.applyTo)) {
      const isMatch = picomatch(pattern, { dot: true });
      const hits = repoFiles.filter((f) => isMatch(f)).length;
      if (hits === 0) {
        findings.push({ file, level: "warning", message: `pattern "${pattern}" matches no file` });
      }
    }
  }
  if (fm.excludeAgent && !ALLOWED_AGENTS.includes(fm.excludeAgent)) {
    findings.push({ file, level: "error", message: `excludeAgent "${fm.excludeAgent}" is not a documented value` });
  }
  if (text.length > SOFT_LIMIT) {
    findings.push({ file, level: "warning", message: `${text.length} characters, please shorten` });
  }
  return findings;
}

export function listFiles(root: string, dir = root): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(root, full));
    else files.push(relative(root, full).split(sep).join("/"));
  }
  return files;
}

export function checkRepository(root: string): Finding[] {
  const repoFiles = listFiles(root);
  const findings: Finding[] = [];
  if (!existsSync(join(root, ".github", "copilot-instructions.md"))) {
    findings.push({ file: ".github/copilot-instructions.md", level: "warning", message: "repository-wide file is missing" });
  }
  const instructionFiles = repoFiles.filter(
    (f) => f.startsWith(".github/instructions/") && f.endsWith(".instructions.md"),
  );
  for (const file of instructionFiles) {
    findings.push(...checkInstructionFile(file, readFileSync(join(root, file), "utf8"), repoFiles));
  }
  return findings;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const findings = checkRepository(process.cwd());
  for (const f of findings) console.log(`${f.level.toUpperCase()} ${f.file}: ${f.message}`);
  const errors = findings.filter((f) => f.level === "error").length;
  console.log(`${findings.length} finding(s), ${errors} error(s)`);
  process.exit(errors > 0 ? 1 : 0);
}
