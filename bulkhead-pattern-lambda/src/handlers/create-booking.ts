// src/handlers/create-booking.ts
// HTTP API: accepts a booking and puts one task per partner into that partner's queue.
import { randomUUID } from 'node:crypto';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { PartnerTask } from '../partner-worker.ts';

export type SendTask = (queueUrl: string, task: PartnerTask) => Promise<void>;

const sqs = new SQSClient({});
const sendWithSqs: SendTask = async (queueUrl, task) => {
  await sqs.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(task) }));
};

export function createBookingHandler(queues: Record<string, string>, send: SendTask = sendWithSqs) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const body = JSON.parse(event.body ?? '{}') as { bikeId?: string; phone?: string; amountCents?: number };
    if (!body.bikeId || !body.phone || !body.amountCents) {
      return { statusCode: 400, body: JSON.stringify({ message: 'bikeId, phone and amountCents are required' }) };
    }

    const bookingId = randomUUID();
    const payloads: Record<string, Record<string, unknown>> = {
      payment: { bookingId, amountCents: body.amountCents },
      lock: { bookingId, bikeId: body.bikeId },
      sms: { bookingId, phone: body.phone, text: `Your bike ${body.bikeId} is booked.` },
    };

    await Promise.all(
      Object.entries(payloads).map(([partner, payload]) => {
        const queueUrl = queues[partner];
        if (!queueUrl) throw new Error(`no queue configured for ${partner}`);
        return send(queueUrl, { bookingId, partner, payload });
      }),
    );

    // 202: the booking is accepted, the partners are called in the background.
    return { statusCode: 202, body: JSON.stringify({ bookingId }) };
  };
}

export const handler = createBookingHandler({
  payment: process.env.PAYMENT_QUEUE_URL ?? '',
  lock: process.env.LOCK_QUEUE_URL ?? '',
  sms: process.env.SMS_QUEUE_URL ?? '',
});
