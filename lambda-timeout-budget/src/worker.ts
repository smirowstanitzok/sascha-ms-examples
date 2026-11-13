// src/worker.ts
import type { Context, SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { Deadline } from './deadline';

// Estimated maximum duration per message (ms); below that we do not start a new one
const PER_MESSAGE_MS = 5000;

export async function sendReturnReminder(body: { rentalId: string }, signal: AbortSignal): Promise<void> {
  // Placeholder for the real delivery (email, push …); respects the signal
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 100);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
  console.log(JSON.stringify({ msg: 'reminder_sent', rentalId: body.rentalId }));
}

export const handler = async (event: SQSEvent, context: Context): Promise<SQSBatchResponse> => {
  const deadline = Deadline.fromLambdaContext(context, { reserveMs: 1000 });
  const failures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    if (deadline.remainingMs() < PER_MESSAGE_MS) {
      // Out of time: return the message to the queue instead of being killed mid-delivery
      failures.push({ itemIdentifier: record.messageId });
      continue;
    }
    try {
      await sendReturnReminder(JSON.parse(record.body), deadline.signalFor('reminder', PER_MESSAGE_MS));
    } catch {
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures: failures };
};
