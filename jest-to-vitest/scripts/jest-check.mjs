// scripts/jest-check.mjs
// Finds places in test files that need manual work when moving from Jest to Vitest.
// Usage: node scripts/jest-check.mjs test
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RULES = [
  { pattern: /jest\.mock\([^,]+,\s*(async\s*)?\(\)\s*=>(?![\s(]*\{)/, hint: "factory does not return an object: return { default: … } in Vitest" },
  { pattern: /jest\.requireActual\(/, hint: "replace with await vi.importActual(…) or importOriginal(), make the factory async" },
  { pattern: /jest\.(Mock|MockedFunction|Mocked|SpyInstance)\b/, hint: "import types from 'vitest' (Mock, Mocked, MockInstance)" },
  { pattern: /jest\.setTimeout\(/, hint: "use vi.setConfig({ testTimeout }) or a timeout test option" },
  { pattern: /useFakeTimers\(\s*\{\s*legacyFakeTimers/, hint: "Vitest has no legacy timers" },
  { pattern: /jest\.replaceProperty\(/, hint: "use vi.stubEnv or vi.spyOn" },
  { pattern: /\b(it|test)\([^)]*\(\s*done\s*\)/, hint: "done callback: rewrite the test with async/await" },
  { pattern: /\.mockReset\(\)/, hint: "in Vitest, mockReset restores the original implementation" },
  { pattern: /JEST_WORKER_ID/, hint: "use VITEST_POOL_ID" },
  { pattern: /aws-sdk-client-mock-jest/, hint: "switch to aws-sdk-client-mock-vitest" },
];

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules") return [];
    return statSync(path).isDirectory() ? files(path) : /\.(test|spec)\.[cm]?[jt]sx?$/.test(name) ? [path] : [];
  });
}

let hits = 0;
for (const file of files(process.argv[2] ?? ".")) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      for (const { pattern, hint } of RULES) {
        if (pattern.test(line)) {
          hits++;
          console.log(file + ":" + (i + 1) + "  " + hint);
        }
      }
    });
}
console.log(hits === 0 ? "No manual work found." : "\n" + hits + " place(s) to check.");
process.exitCode = hits === 0 ? 0 : 1;
