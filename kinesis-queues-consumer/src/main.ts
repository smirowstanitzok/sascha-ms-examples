// src/main.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { KinesisClient } from '@aws-sdk/client-kinesis';
import { DynamoIdempotencyStore } from './idempotency.js';
import { QueueWorker } from './queue-worker.js';
import { createTicketMailer } from './ticket-mailer.js';

const queueArn = process.env.QUEUE_ARN;
const tableName = process.env.IDEMPOTENCY_TABLE;
if (!queueArn || !tableName) throw new Error('QUEUE_ARN and IDEMPOTENCY_TABLE are required');

const store = new DynamoIdempotencyStore(new DynamoDBClient({}), tableName);

// Stand-in for the real mail service (e.g. Amazon SES).
const sendMail = async (ticket: { orderId: string; email: string; eventName: string }) => {
  console.log(JSON.stringify({ message: 'ticket mail sent', orderId: ticket.orderId, event: ticket.eventName }));
};

const worker = new QueueWorker(new KinesisClient({}), {
  queueArn,
  handler: createTicketMailer(store, sendMail),
});

// Fargate sends SIGTERM on scale-in: finish the batch, then exit.
process.on('SIGTERM', () => worker.stop());
process.on('SIGINT', () => worker.stop());

await worker.run();
console.log(JSON.stringify({ message: 'worker stopped' }));
