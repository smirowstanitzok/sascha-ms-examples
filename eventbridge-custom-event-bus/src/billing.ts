// src/billing.ts
import type { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { bikeReturnedEnvelopeSchema, type BikeReturned } from './events.ts';

// 1 € base fee plus 15 cents per started minute, everything in cents
export const priceInCents = (minutes: number): number => 100 + 15 * Math.ceil(minutes);

export const bill = async (ride: BikeReturned): Promise<void> => {
  // In real life: store the invoice line idempotently, e.g. keyed by returnId
  console.log(
    JSON.stringify({
      msg: 'Return billed',
      customerId: ride.customerId,
      returnId: ride.returnId,
      amountCents: priceInCents(ride.minutes),
    }),
  );
};

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const failures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    // FIFO: stop processing after the first failure, otherwise the order breaks
    if (failures.length > 0) {
      failures.push({ itemIdentifier: record.messageId });
      continue;
    }
    try {
      const envelope = bikeReturnedEnvelopeSchema.parse(JSON.parse(record.body));
      await bill(envelope.detail);
    } catch (error) {
      console.error(JSON.stringify({ msg: 'Billing failed', messageId: record.messageId, error: String(error) }));
      failures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures: failures };
};
