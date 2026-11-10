// test/retention.test.ts
import { describe, expect, it } from "vitest";
import {
  buildPolicyDocument,
  buildSelectionCriteria,
  effectiveRetention,
  formatBytes,
  parsePolicy,
  parseRetention,
  planChange,
  summarize,
  type LogGroupInfo,
  type RetentionPolicy,
} from "../src/retention.js";

const DAY = 24 * 60 * 60 * 1000;
const policyTime = Date.UTC(2026, 10, 10);

const group = (name: string, retentionInDays?: number, ageDays = 100, gib = 1): LogGroupInfo => ({
  name,
  retentionInDays,
  creationTime: policyTime - ageDays * DAY,
  storedBytes: gib * 1024 ** 3,
});

const policy = (p: Partial<RetentionPolicy> & Pick<RetentionPolicy, "name" | "retention">): RetentionPolicy => ({
  mode: "RETROACTIVE",
  createdAt: policyTime,
  ...p,
});

describe("parseRetention", () => {
  it("accepts allowed days and 'never'", () => {
    expect(parseRetention("90")).toBe(90);
    expect(parseRetention("never")).toBe("NEVER_EXPIRE");
  });

  it("rejects values below 30 days or outside the list", () => {
    expect(() => parseRetention("14")).toThrow(/Allowed/);
    expect(() => parseRetention("100")).toThrow(/Allowed/);
  });
});

describe("documents", () => {
  it("builds the policy document and the selection criteria", () => {
    expect(buildPolicyDocument(90, "RETROACTIVE")).toBe('{"retentionInDays":90,"enforcementMode":"RETROACTIVE"}');
    expect(buildSelectionCriteria("/aws/lambda")).toBe('LogGroupNamePrefix="/aws/lambda"');
    expect(buildSelectionCriteria()).toBeUndefined();
  });

  it("parses a policy returned by the API", () => {
    const parsed = parsePolicy({
      policyName: "lambda-baseline",
      policyDocument: '{"retentionInDays":90,"enforcementMode":"NEW_ONLY"}',
      selectionCriteria: 'LogGroupNamePrefix="/aws/lambda"',
      lastUpdatedTime: 42,
    });
    expect(parsed).toEqual({
      name: "lambda-baseline",
      prefix: "/aws/lambda",
      retention: 90,
      mode: "NEW_ONLY",
      createdAt: 42,
    });
  });
});

describe("effectiveRetention", () => {
  it("keeps the log group's own value when no policy matches", () => {
    expect(effectiveRetention(group("/bookshop/api", 14), []).retention).toBe(14);
    expect(effectiveRetention(group("/bookshop/api"), []).retention).toBe("NEVER_EXPIRE");
  });

  it("lets the longest matching policy win", () => {
    const policies = [
      policy({ name: "baseline", retention: 90 }),
      policy({ name: "audit", prefix: "/audit", retention: 731 }),
    ];
    expect(effectiveRetention(group("/audit/payments"), policies)).toEqual({ retention: 731, decidedBy: "audit" });
    expect(effectiveRetention(group("/aws/lambda/orders"), policies)).toEqual({ retention: 90, decidedBy: "baseline" });
  });

  it("treats NEVER_EXPIRE as the longest retention", () => {
    const policies = [
      policy({ name: "baseline", retention: 3653 }),
      policy({ name: "legal-hold", prefix: "/legal", retention: "NEVER_EXPIRE" }),
    ];
    expect(effectiveRetention(group("/legal/contracts"), policies).retention).toBe("NEVER_EXPIRE");
  });

  it("replaces a longer log group setting", () => {
    const result = effectiveRetention(group("/bookshop/archive", 3653), [policy({ name: "baseline", retention: 90 })]);
    expect(result.retention).toBe(90);
  });

  it("ignores existing log groups for NEW_ONLY policies", () => {
    const newOnly = [policy({ name: "baseline", retention: 90, mode: "NEW_ONLY" })];
    expect(effectiveRetention(group("/old/group", 3653, 100), newOnly).retention).toBe(3653);
    expect(effectiveRetention(group("/new/group", undefined, -1), newOnly).retention).toBe(90);
  });
});

describe("planChange", () => {
  it("finds log groups that would lose data, largest first", () => {
    const groups = [
      group("/aws/lambda/checkout", 7, 100, 2),
      group("/aws/lambda/search", undefined, 100, 5),
      group("/bikerental/audit", 1827, 100, 8),
      group("/aws/lambda/reports", 90, 100, 1),
    ];
    const plan = planChange(groups, [], policy({ name: "baseline", retention: 90 }));

    expect(summarize(plan)).toEqual({ shorter: 2, longer: 1, unchanged: 1 });
    expect(plan[0]).toMatchObject({ kind: "shorter", before: 1827, after: 90 });
    expect(plan.find((c) => c.group.name === "/aws/lambda/checkout")).toMatchObject({ kind: "longer", before: 7, after: 90 });
  });

  it("replaces an existing policy with the same name instead of stacking it", () => {
    const existing = [policy({ name: "baseline", retention: 365 })];
    const plan = planChange([group("/bookshop/api")], existing, policy({ name: "baseline", retention: 90 }));
    expect(plan[0]).toMatchObject({ before: 365, after: 90, kind: "shorter" });
  });
});

describe("formatBytes", () => {
  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3.0 GiB");
  });
});
