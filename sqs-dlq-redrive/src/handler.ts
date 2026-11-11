// src/handler.ts
import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { InvalidOrderError, parseOrder, type TicketOrder } from './order.js';

export type IssueTickets = (order: TicketOrder) => Promise<void>;

export function createHandler(issueTickets: IssueTickets) {
  return async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

    for (const record of event.Records) {
      try {
        const order = parseOrder(record.body);
        await issueTickets(order);
      } catch (error) {
        // Only log metadata, never the full body (it contains an email address)
        console.error(JSON.stringify({
          level: 'ERROR',
          messageId: record.messageId,
          receiveCount: Number(record.attributes.ApproximateReceiveCount),
          permanent: error instanceof InvalidOrderError,
          error: error instanceof Error ? error.message : String(error),
        }));
        // Only this message goes back to the queue, the rest of the batch counts as done
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }

    return { batchItemFailures };
  };
}

const issueTicketsViaApi: IssueTickets = async (order) => {
  const url = process.env.TICKET_API_URL;
  if (!url) throw new Error('TICKET_API_URL is not set');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': order.orderId },
    body: JSON.stringify(order),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new Error(`Ticket API responded with status ${response.status}`);
  }
};

export const handler = createHandler(issueTicketsViaApi);
