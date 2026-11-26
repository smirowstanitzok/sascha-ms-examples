// microvm/check.ts
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, normalize, isAbsolute } from "node:path";

export interface SourceFile {
  path: string; // relative, e.g. "src/loans.ts"
  content: string;
}

export interface TestResult {
  passed: boolean;
  exitCode: number | null;
  durationMs: number;
  output: string; // truncated so the result stays below 256 KB
}

const MAX_OUTPUT = 8_000;

// Writes the patch files into a dedicated working directory.
export async function writeFiles(
  base: string,
  files: SourceFile[],
): Promise<string> {
  await mkdir(base, { recursive: true });
  for (const file of files) {
    const relative = normalize(file.path);
    // No escaping the working directory via "../" or absolute paths
    if (isAbsolute(relative) || relative.startsWith("..")) {
      throw new Error(`Invalid path: ${file.path}`);
    }
    const target = join(base, relative);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
  }
  return base;
}

// Runs the tests in the directory with the built-in Node.js test runner.
export function runTests(
  directory: string,
  signal: AbortSignal,
  timeLimitMs = 120_000,
): Promise<TestResult> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--test", "--experimental-strip-types"],
      {
        cwd: directory,
        // Pass on only the bare minimum of environment variables
        env: { PATH: process.env.PATH ?? "/usr/bin:/bin", NODE_ENV: "test" },
        signal,
        timeout: timeLimitMs,
      },
    );
    let output = "";
    const collect = (chunk: Buffer) => {
      if (output.length < MAX_OUTPUT) output += chunk.toString("utf8");
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", (error) => {
      if (error.name === "AbortError") reject(error);
    });
    child.on("close", (exitCode) => {
      resolve({
        passed: exitCode === 0,
        exitCode,
        durationMs: Date.now() - start,
        output: output.slice(0, MAX_OUTPUT),
      });
    });
  });
}
