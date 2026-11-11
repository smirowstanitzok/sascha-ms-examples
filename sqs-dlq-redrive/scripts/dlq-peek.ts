// scripts/dlq-peek.ts
// Reads messages from a dead-letter queue WITHOUT deleting them
// and groups them by cause.
// Usage: npx tsx scripts/dlq-peek.ts <dlq-url> [max-messages]
import { ReceiveMessageCommand, SQSClient, type Message } from '@aws-sdk/client-sqs';
import { parseOrder } from '../src/order.js';

const [queueUrl, maxArg = '50'] = process.argv.slice(2);
if (!queueUrl) {
  console.error('Usage: npx tsx scripts/dlq-peek.ts <dlq-url> [max-messages]');
  process.exit(1);
}
const maxMessages = Math.min(Number(maxArg), 200);
const sqs = new SQSClient({});

// Mask email addresses before anything ends up in the terminal or a ticket
const mask = (text: string) => text.replace(/[^\s"@]+@[^\s"@]+/g, '***@***');

function classify(message: Message): string {
  try {
    parseOrder(message.Body ?? '');
    return 'valid – probably a temporary error (redrive candidate)';
  } catch (error) {
    return `invalid: ${(error as Error).message}`;
  }
}

const seen = new Map<string, Message>();
let emptyPolls = 0;

while (seen.size < maxMessages && emptyPolls < 2) {
  const { Messages = [] } = await sqs.send(new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 2,
    // Short visibility: the messages reappear after 60 seconds
    VisibilityTimeout: 60,
    MessageSystemAttributeNames: ['ApproximateReceiveCount', 'SentTimestamp', 'DeadLetterQueueSourceArn'],
  }));
  if (Messages.length === 0) emptyPolls++;
  for (const m of Messages) if (m.MessageId) seen.set(m.MessageId, m);
}

const groups = new Map<string, Message[]>();
for (const m of seen.values()) {
  const key = classify(m);
  groups.set(key, [...(groups.get(key) ?? []), m]);
}

console.log(`${seen.size} message(s) peeked, nothing deleted.\n`);
for (const [cause, messages] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
  const sample = messages[0];
  const sent = new Date(Number(sample.Attributes?.SentTimestamp)).toISOString();
  console.log(`${messages.length}× ${cause}`);
  console.log(`   Example ${sample.MessageId} (sent ${sent}, source ${sample.Attributes?.DeadLetterQueueSourceArn ?? 'unknown'})`);
  console.log(`   ${mask(sample.Body ?? '').slice(0, 160)}\n`);
}
