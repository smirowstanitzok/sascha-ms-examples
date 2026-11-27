// cost-check/rules.ts
export type Severity = 'high' | 'medium' | 'low';

export interface FunctionInfo {
  name: string;
  architecture: 'x86_64' | 'arm64';
  memoryMb: number;
  logFormat: 'Text' | 'JSON';
  appLogLevel?: string;
  invocations30Days: number;
  provisioned: number; // total provisioned concurrency across all aliases/versions
}

export interface LogGroupInfo {
  name: string;
  retentionDays?: number; // undefined = "Never expire"
  storedBytes: number;
}

export interface Finding {
  resource: string;
  severity: Severity;
  hint: string;
}

const GIB = 1024 ** 3;

export function checkFunction(f: FunctionInfo): Finding[] {
  const findings: Finding[] = [];
  const add = (severity: Severity, hint: string) =>
    findings.push({ resource: `lambda:${f.name}`, severity, hint });

  if (f.provisioned > 0 && f.invocations30Days === 0) {
    add('high', `Provisioned concurrency (${f.provisioned}) without invocations in 30 days – billed around the clock`);
  } else if (f.invocations30Days === 0) {
    add('low', 'No invocations in 30 days – is the function still needed?');
  }
  if (f.architecture === 'x86_64') {
    add('medium', 'Runs on x86_64 – check switching to arm64');
  }
  if (f.memoryMb >= 1536) {
    add('low', `${f.memoryMb} MB memory – measure again with Lambda Power Tuning`);
  }
  if (f.logFormat !== 'JSON') {
    add('medium', 'Text log format – with JSON, Lambda can filter log levels itself');
  } else if (f.appLogLevel && ['TRACE', 'DEBUG'].includes(f.appLogLevel.toUpperCase())) {
    add('medium', `Application log level ${f.appLogLevel} – usually too chatty for production`);
  }
  return findings;
}

export function checkLogGroup(g: LogGroupInfo): Finding[] {
  const resource = `logs:${g.name}`;
  if (g.retentionDays === undefined) {
    return [{
      resource,
      severity: g.storedBytes > GIB ? 'high' : 'medium',
      hint: `No retention period, ${formatBytes(g.storedBytes)} stored`,
    }];
  }
  if (g.retentionDays > 90) {
    return [{ resource, severity: 'low', hint: `Retention ${g.retentionDays} days – really needed?` }];
  }
  return [];
}

export function formatBytes(bytes: number): string {
  if (bytes >= GIB) return `${(bytes / GIB).toFixed(1)} GiB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}

const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export function toMarkdown(findings: Finding[]): string {
  if (findings.length === 0) return 'No issues found.';
  const rows = [...findings]
    .sort((a, b) => rank[a.severity] - rank[b.severity] || a.resource.localeCompare(b.resource))
    .map((f) => `| ${f.severity} | ${f.resource} | ${f.hint} |`);
  return ['| Severity | Resource | Hint |', '| --- | --- | --- |', ...rows].join('\n');
}
