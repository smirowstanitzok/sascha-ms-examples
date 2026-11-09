// test/check-instructions.test.ts
import { describe, expect, it } from "vitest";
import { checkInstructionFile, parseFrontmatter, splitPatterns } from "../scripts/check-instructions.js";

const repoFiles = [
  "infra/lib/rental-stack.ts",
  "services/rentals/src/handlers/create-rental.ts",
  "services/rentals/src/handlers/create-rental.test.ts",
  "README.md",
];

describe("parseFrontmatter", () => {
  it("reads applyTo and excludeAgent", () => {
    const fm = parseFrontmatter('---\napplyTo: "infra/**/*.ts"\nexcludeAgent: "code-review"\n---\n# CDK');
    expect(fm).toEqual({ applyTo: "infra/**/*.ts", excludeAgent: "code-review" });
  });

  it("returns null without frontmatter", () => {
    expect(parseFrontmatter("# Only text")).toBeNull();
  });
});

describe("splitPatterns", () => {
  it("splits comma-separated globs", () => {
    expect(splitPatterns("**/*.ts, **/*.tsx")).toEqual(["**/*.ts", "**/*.tsx"]);
  });
});

describe("checkInstructionFile", () => {
  it("accepts a valid file", () => {
    const text = '---\napplyTo: "services/**/src/handlers/**/*.ts"\n---\nUse Powertools Logger.';
    expect(checkInstructionFile("handlers.instructions.md", text, repoFiles)).toEqual([]);
  });

  it("warns when a pattern matches no file", () => {
    const text = '---\napplyTo: "*.ts"\n---\nRoot only.';
    const [finding] = checkInstructionFile("root.instructions.md", text, repoFiles);
    expect(finding.level).toBe("warning");
    expect(finding.message).toMatch(/matches no file/);
  });

  it("reports a missing applyTo as an error", () => {
    const text = "---\ndescription: Tests\n---\nUse vitest.";
    const [finding] = checkInstructionFile("tests.instructions.md", text, repoFiles);
    expect(finding).toMatchObject({ level: "error", message: "applyTo is missing" });
  });

  it("rejects unknown excludeAgent values", () => {
    const text = '---\napplyTo: "**/*.ts"\nexcludeAgent: "chat"\n---\nText';
    const findings = checkInstructionFile("x.instructions.md", text, repoFiles);
    expect(findings.some((f) => f.message.includes("not a documented value"))).toBe(true);
  });
});
