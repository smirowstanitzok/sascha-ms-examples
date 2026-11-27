// cost-check/index.ts
import { CloudWatchClient, GetMetricDataCommand, type MetricDataQuery } from '@aws-sdk/client-cloudwatch';
import { CloudWatchLogsClient, paginateDescribeLogGroups } from '@aws-sdk/client-cloudwatch-logs';
import {
  LambdaClient,
  paginateListFunctions,
  paginateListProvisionedConcurrencyConfigs,
  type FunctionConfiguration,
} from '@aws-sdk/client-lambda';
import {
  checkFunction,
  checkLogGroup,
  toMarkdown,
  type Finding,
  type FunctionInfo,
} from './rules.ts';

const lambda = new LambdaClient({});
const cloudwatch = new CloudWatchClient({});
const logs = new CloudWatchLogsClient({});
const DAY_MS = 24 * 60 * 60 * 1000;

async function loadFunctions(): Promise<FunctionConfiguration[]> {
  const all: FunctionConfiguration[] = [];
  for await (const page of paginateListFunctions({ client: lambda }, {})) {
    all.push(...(page.Functions ?? []));
  }
  return all;
}

// Invocations in the last 30 days, up to 500 functions per GetMetricData call
async function loadInvocations(names: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const end = new Date();
  const start = new Date(end.getTime() - 30 * DAY_MS);
  for (let i = 0; i < names.length; i += 500) {
    const chunk = names.slice(i, i + 500);
    const queries: MetricDataQuery[] = chunk.map((name, j) => ({
      Id: `f${j}`,
      MetricStat: {
        Metric: { Namespace: 'AWS/Lambda', MetricName: 'Invocations', Dimensions: [{ Name: 'FunctionName', Value: name }] },
        Period: 30 * 24 * 60 * 60,
        Stat: 'Sum',
      },
    }));
    let nextToken: string | undefined;
    do {
      const response = await cloudwatch.send(
        new GetMetricDataCommand({ MetricDataQueries: queries, StartTime: start, EndTime: end, NextToken: nextToken }),
      );
      for (const r of response.MetricDataResults ?? []) {
        const name = chunk[Number(r.Id?.slice(1))];
        const sum = (r.Values ?? []).reduce((a, b) => a + b, 0);
        result.set(name, (result.get(name) ?? 0) + sum);
      }
      nextToken = response.NextToken;
    } while (nextToken);
  }
  return result;
}

async function loadProvisioned(name: string): Promise<number> {
  let sum = 0;
  for await (const page of paginateListProvisionedConcurrencyConfigs({ client: lambda }, { FunctionName: name })) {
    for (const c of page.ProvisionedConcurrencyConfigs ?? []) sum += c.RequestedProvisionedConcurrentExecutions ?? 0;
  }
  return sum;
}

async function main(): Promise<void> {
  const findings: Finding[] = [];

  const functions = await loadFunctions();
  const invocations = await loadInvocations(functions.map((f) => f.FunctionName!));
  for (const f of functions) {
    const info: FunctionInfo = {
      name: f.FunctionName!,
      architecture: f.Architectures?.[0] === 'arm64' ? 'arm64' : 'x86_64',
      memoryMb: f.MemorySize ?? 128,
      logFormat: f.LoggingConfig?.LogFormat === 'JSON' ? 'JSON' : 'Text',
      appLogLevel: f.LoggingConfig?.ApplicationLogLevel,
      invocations30Days: invocations.get(f.FunctionName!) ?? 0,
      provisioned: await loadProvisioned(f.FunctionName!),
    };
    findings.push(...checkFunction(info));
  }

  for await (const page of paginateDescribeLogGroups({ client: logs }, {})) {
    for (const g of page.logGroups ?? []) {
      findings.push(
        ...checkLogGroup({
          name: g.logGroupName!,
          retentionDays: g.retentionInDays,
          storedBytes: g.storedBytes ?? 0,
        }),
      );
    }
  }

  console.log(`# Cost check (${new Date().toISOString().slice(0, 10)})\n`);
  console.log(`${functions.length} functions checked, ${findings.length} findings\n`);
  console.log(toMarkdown(findings));
}

main().catch((error) => {
  console.error('Cost check failed:', error);
  process.exitCode = 1;
});
