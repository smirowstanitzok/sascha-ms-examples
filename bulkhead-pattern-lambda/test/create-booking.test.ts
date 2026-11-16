// test/create-booking.test.ts
import { describe, expect, it } from 'vitest';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { createBookingHandler } from '../src/handlers/create-booking.ts';
import type { PartnerTask } from '../src/partner-worker.ts';

const queues = { payment: 'q-payment', lock: 'q-lock', sms: 'q-sms' };
const request = (body: unknown) => ({ body: JSON.stringify(body) }) as APIGatewayProxyEventV2;

describe('createBookingHandler', () => {
  it('puts one task into each partner queue and answers 202', async () => {
    const sent: Array<[string, PartnerTask]> = [];
    const handler = createBookingHandler(queues, async (url, task) => {
      sent.push([url, task]);
    });
    const res = (await handler(request({ bikeId: 'bike-7', phone: '+4915100000000', amountCents: 1200 }))) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(202);
    expect(sent.map(([url]) => url).sort()).toEqual(['q-lock', 'q-payment', 'q-sms']);
  });

  it('rejects incomplete bookings', async () => {
    const handler = createBookingHandler(queues, async () => {});
    const res = (await handler(request({ bikeId: 'bike-7' }))) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(400);
  });
});
