// src/ticket-mailer.ts
import type { QueueRecord } from '@aws-sdk/client-kinesis';
import type { IdempotencyStore } from './idempotency.js';
import type { RecordHandler } from './queue-worker.js';

export interface TicketSold {
  orderId: string;
  eventName: string;
  email: string;
  seats: number;
}

export type SendTicketMail = (ticket: TicketSold) => Promise<void>;

export class BusyError extends Error {}

export function parseTicketSold(data: Uint8Array | undefined): TicketSold {
  if (!data) throw new Error('record without data');
  const value = JSON.parse(Buffer.from(data).toString('utf8')) as Partial<TicketSold>;
  if (!value.orderId || !value.eventName || !value.email || !value.seats) {
    throw new Error('incomplete ticket event');
  }
  return value as TicketSold;
}

/** Sends the ticket mail exactly once per order, even if the queue delivers twice. */
export function createTicketMailer(store: IdempotencyStore, sendMail: SendTicketMail): RecordHandler {
  return async (record: QueueRecord) => {
    const ticket = parseTicketSold(record.Data);
    const key = `ticket-mail#${ticket.orderId}`;

    const claim = await store.claim(key);
    if (claim === 'done') return; // already sent: just acknowledge
    if (claim === 'busy') throw new BusyError(`order ${ticket.orderId} is being processed`);

    try {
      await sendMail(ticket);
      await store.complete(key);
    } catch (error) {
      await store.release(key);
      throw error;
    }
  };
}
