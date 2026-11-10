// test/detectors.test.ts
import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { scanText } from "../src/detectors.js";
import { scanLogArchive } from "../src/scan-zip.js";

// Test data is assembled at runtime so that no scanner flags this file.
const fakeKeyId = "AKIA" + "EXAMPLE7EXAMPLE7";
const fakeSecret = "wJalrXUtnFEMI/K7MDENG/" + "bPxRfiCYEXAMPLEKEY01";
const fakeGitHub = "ghp_" + "a".repeat(36);

describe("scanText", () => {
  it("finds an AWS key ID in a log line", () => {
    const log = `2026-11-10T09:00:00.0000000Z Using key ${fakeKeyId}`;
    const findings = scanText(log, "deploy/3_Configure.txt");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule: "aws-access-key-id", line: 1 });
  });

  it("finds credentials from assume-role JSON output", () => {
    const log = `{\n  "AccessKeyId": "${"ASIA" + "EXAMPLE7EXAMPLE7"}",\n  "SecretAccessKey": "${fakeSecret}"\n}`;
    const rules = scanText(log, "x.txt").map((f) => f.rule);
    expect(rules).toEqual(["aws-access-key-id", "aws-secret-access-key"]);
  });

  it("never prints the full secret", () => {
    const [finding] = scanText(`token=${fakeGitHub}`, "x.txt");
    expect(finding.preview).toBe("ghp_…(40 chars)");
    expect(finding.preview).not.toContain(fakeGitHub);
  });

  it("ignores values already masked by Actions", () => {
    expect(scanText("AWS_SECRET_ACCESS_KEY: ***", "x.txt")).toEqual([]);
    expect(scanText("https://deploy:***@git.example.com/repo.git", "x.txt")).toEqual([]);
  });

  it("finds a password inside a URL", () => {
    const [finding] = scanText("cloning https://deploy:s3cr3tpass@git.example.com/repo.git", "x.txt");
    expect(finding.rule).toBe("url-credentials");
  });
});

describe("scanLogArchive", () => {
  it("scans every text file in the zip", () => {
    const zip = zipSync({
      "build/1_Set up job.txt": strToU8("nothing to see"),
      "build/4_Debug.txt": strToU8(`line one\nexport NPM_TOKEN=${"npm_" + "b".repeat(36)}`),
    });
    const findings = scanLogArchive(zip);
    expect(findings).toEqual([
      { rule: "npm-token", file: "build/4_Debug.txt", line: 2, preview: "npm_…(40 chars)" },
    ]);
  });
});
