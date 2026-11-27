// scripts/run-tuning.ts
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { SFNClient, StartExecutionCommand, DescribeExecutionCommand } from '@aws-sdk/client-sfn';
import { formatTable, pickSweetSpot, toRows, type TuningOutput } from '../src/report.ts';

const stateMachineArn = process.env.TUNER_ARN;
const inputFile = process.argv[2] ?? 'tuning-input.json';
if (!stateMachineArn) {
  console.error('Please set TUNER_ARN (output of the CDK stack).');
  process.exit(1);
}

const sfn = new SFNClient({});
const input = readFileSync(inputFile, 'utf8');
const { executionArn } = await sfn.send(new StartExecutionCommand({ stateMachineArn, input }));
console.log(`Started: ${executionArn}`);

let status = 'RUNNING';
let output: string | undefined;
while (status === 'RUNNING') {
  await sleep(5000);
  const res = await sfn.send(new DescribeExecutionCommand({ executionArn }));
  status = res.status ?? 'UNKNOWN';
  output = res.output;
  process.stdout.write('.');
}
console.log(`\nStatus: ${status}`);
if (status !== 'SUCCEEDED' || !output) process.exit(1);

const result = JSON.parse(output) as { results?: TuningOutput } & TuningOutput;
const tuning = result.results ?? result;
const rows = toRows(tuning);
console.log(formatTable(rows));
console.log(`State machine recommendation: ${tuning.power} MB`);
console.log(`Sweet spot (max. 10% more expensive, at least 20% faster): ${pickSweetSpot(rows).memoryMb} MB`);
console.log(`Chart: ${tuning.stateMachine.visualization}`);
