// microvm/check.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFiles, runTests } from "./check.ts";

const greenPatch = [
  { path: "loans.js", content: "export const extend = (days) => days + 14;\n" },
  {
    path: "loans.test.js",
    content:
      'import { test } from "node:test";\nimport assert from "node:assert";\nimport { extend } from "./loans.js";\ntest("extends by 14 days", () => assert.equal(extend(7), 21));\n',
  },
  { path: "package.json", content: '{ "type": "module" }\n' },
];

test("green patch passes", async () => {
  const dir = await writeFiles(await mkdtemp(join(tmpdir(), "pc-")), greenPatch);
  const result = await runTests(dir, new AbortController().signal);
  assert.equal(result.passed, true);
  assert.equal(result.exitCode, 0);
});

test("red patch fails", async () => {
  const red = greenPatch.map((f) =>
    f.path === "loans.js" ? { ...f, content: "export const extend = (d) => d + 7;\n" } : f,
  );
  const dir = await writeFiles(await mkdtemp(join(tmpdir(), "pc-")), red);
  const result = await runTests(dir, new AbortController().signal);
  assert.equal(result.passed, false);
  assert.match(result.output, /extends by 14 days/);
});

test("paths outside the workspace are rejected", async () => {
  const base = await mkdtemp(join(tmpdir(), "pc-"));
  await assert.rejects(
    writeFiles(base, [{ path: "../../etc/evil", content: "x" }]),
    /Invalid path/,
  );
});
