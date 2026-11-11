// scripts/dlq-redrive.ts
// Starts a controlled redrive from the DLQ and reports progress.
// Usage: npx tsx scripts/dlq-redrive.ts <dlq-arn> [messages-per-second]
import {
  CancelMessageMoveTaskCommand,
  ListMessageMoveTasksCommand,
  SQSClient,
  StartMessageMoveTaskCommand,
} from '@aws-sdk/client-sqs';

const [sourceArn, rateArg = '5'] = process.argv.slice(2);
if (!sourceArn?.startsWith('arn:aws:sqs:')) {
  console.error('Usage: npx tsx scripts/dlq-redrive.ts <dlq-arn> [messages-per-second]');
  process.exit(1);
}
const rate = Math.min(Math.max(Number(rateArg), 1), 500);
const sqs = new SQSClient({});
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Only one task per queue can run at a time
const { Results: previous = [] } = await sqs.send(new ListMessageMoveTasksCommand({ SourceArn: sourceArn, MaxResults: 1 }));
if (previous[0]?.Status === 'RUNNING') {
  console.error('A redrive is already running for this DLQ. Aborting.');
  process.exit(1);
}

// Without DestinationArn, every message goes back to its original source queue
const { TaskHandle } = await sqs.send(new StartMessageMoveTaskCommand({
  SourceArn: sourceArn,
  MaxNumberOfMessagesPerSecond: rate,
}));
console.log(`Redrive started at ${rate} messages per second. Ctrl+C cancels.`);

process.on('SIGINT', async () => {
  await sqs.send(new CancelMessageMoveTaskCommand({ TaskHandle }));
  console.log('\nCancellation requested. Messages already moved stay in the destination queue.');
  process.exit(130);
});

while (true) {
  await sleep(10_000);
  const { Results = [] } = await sqs.send(new ListMessageMoveTasksCommand({ SourceArn: sourceArn, MaxResults: 1 }));
  const task = Results[0];
  if (!task) continue;
  console.log(`${task.Status}: ${task.ApproximateNumberOfMessagesMoved ?? 0} of ${task.ApproximateNumberOfMessagesToMove ?? '?'} moved`);
  if (task.Status === 'FAILED') {
    console.error(`Failed: ${task.FailureReason}`);
    process.exit(1);
  }
  if (task.Status === 'COMPLETED' || task.Status === 'CANCELLED') break;
}
