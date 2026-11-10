// src/retention.ts
// Pure planning logic for account-level CloudWatch Logs retention policies.
// No AWS calls in here, so everything can be unit-tested offline.

/** Retention values (in days) that account-level policies accept. */
export const ALLOWED_DAYS = [
  30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922,
  3288, 3653,
] as const;

export type Retention = number | "NEVER_EXPIRE";
export type EnforcementMode = "RETROACTIVE" | "NEW_ONLY";

export interface RetentionPolicy {
  name: string;
  /** Log group name prefix; undefined = all log groups in the account. */
  prefix?: string;
  retention: Retention;
  mode: EnforcementMode;
  /** When the policy was created (epoch ms). Needed for NEW_ONLY. */
  createdAt: number;
}

export interface LogGroupInfo {
  name: string;
  /** Retention set on the log group itself; undefined = never expire. */
  retentionInDays?: number;
  creationTime: number;
  storedBytes: number;
}

export type ChangeKind = "shorter" | "longer" | "unchanged";

export interface PlannedChange {
  group: LogGroupInfo;
  before: Retention;
  after: Retention;
  kind: ChangeKind;
  /** Name of the policy that decides the retention after the change. */
  decidedBy?: string;
}

/** Parses CLI input like "90" or "never" into a valid retention value. */
export function parseRetention(input: string): Retention {
  const value = input.trim().toLowerCase();
  if (value === "never" || value === "never_expire") return "NEVER_EXPIRE";
  const days = Number(value);
  if (!Number.isInteger(days) || !(ALLOWED_DAYS as readonly number[]).includes(days)) {
    throw new Error(
      `Invalid retention "${input}". Allowed: ${ALLOWED_DAYS.join(", ")} or "never".`,
    );
  }
  return days;
}

/** Builds the policyDocument string for PutAccountPolicy. */
export function buildPolicyDocument(retention: Retention, mode: EnforcementMode): string {
  return JSON.stringify({ retentionInDays: retention, enforcementMode: mode });
}

/** Builds the selectionCriteria string, or undefined for "all log groups". */
export function buildSelectionCriteria(prefix?: string): string | undefined {
  if (prefix === undefined || prefix === "") return undefined;
  if (prefix.includes('"')) throw new Error("Prefix must not contain double quotes.");
  return `LogGroupNamePrefix="${prefix}"`;
}

/** Reads a policy as returned by DescribeAccountPolicies. */
export function parsePolicy(p: {
  policyName?: string;
  policyDocument?: string;
  selectionCriteria?: string;
  lastUpdatedTime?: number;
}): RetentionPolicy {
  const doc = JSON.parse(p.policyDocument ?? "{}") as {
    retentionInDays?: Retention;
    enforcementMode?: EnforcementMode;
  };
  const match = /LogGroupNamePrefix\s*=\s*"([^"]*)"/.exec(p.selectionCriteria ?? "");
  return {
    name: p.policyName ?? "unknown",
    prefix: match?.[1],
    retention: doc.retentionInDays ?? "NEVER_EXPIRE",
    mode: doc.enforcementMode ?? "RETROACTIVE",
    // The API only returns lastUpdatedTime, which is the best approximation we have.
    createdAt: p.lastUpdatedTime ?? 0,
  };
}

/** Does a policy apply to a given log group? */
export function policyMatches(policy: RetentionPolicy, group: LogGroupInfo): boolean {
  const prefixOk = policy.prefix === undefined || group.name.startsWith(policy.prefix);
  const modeOk = policy.mode === "RETROACTIVE" || group.creationTime >= policy.createdAt;
  return prefixOk && modeOk;
}

/** Compares two retention values. NEVER_EXPIRE is the longest. */
export function compareRetention(a: Retention, b: Retention): number {
  const toNumber = (r: Retention) => (r === "NEVER_EXPIRE" ? Number.POSITIVE_INFINITY : r);
  return toNumber(a) - toNumber(b);
}

/**
 * Effective retention of a log group: if at least one account policy matches,
 * the longest matching policy wins and REPLACES the log group's own setting
 * (even if that setting was longer). Otherwise the log group's own value counts.
 */
export function effectiveRetention(
  group: LogGroupInfo,
  policies: RetentionPolicy[],
): { retention: Retention; decidedBy?: string } {
  const matching = policies.filter((p) => policyMatches(p, group));
  if (matching.length === 0) {
    return { retention: group.retentionInDays ?? "NEVER_EXPIRE" };
  }
  const winner = matching.reduce((best, p) =>
    compareRetention(p.retention, best.retention) > 0 ? p : best,
  );
  return { retention: winner.retention, decidedBy: winner.name };
}

/** Simulates adding (or replacing) a policy and lists the effect per log group. */
export function planChange(
  groups: LogGroupInfo[],
  existing: RetentionPolicy[],
  candidate: RetentionPolicy,
): PlannedChange[] {
  const after = [...existing.filter((p) => p.name !== candidate.name), candidate];
  return groups
    .map((group) => {
      const before = effectiveRetention(group, existing).retention;
      const next = effectiveRetention(group, after);
      const diff = compareRetention(next.retention, before);
      const kind: ChangeKind = diff < 0 ? "shorter" : diff > 0 ? "longer" : "unchanged";
      return { group, before, after: next.retention, kind, decidedBy: next.decidedBy };
    })
    .sort((a, b) => b.group.storedBytes - a.group.storedBytes);
}

/** Groups the plan by kind, e.g. for a short summary. */
export function summarize(plan: PlannedChange[]): Record<ChangeKind, number> {
  const summary: Record<ChangeKind, number> = { shorter: 0, longer: 0, unchanged: 0 };
  for (const change of plan) summary[change.kind] += 1;
  return summary;
}

/** Human-readable bytes (base 1024). */
export function formatBytes(bytes: number): string {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
