// src/order.ts
export interface TicketOrder {
  orderId: string;
  eventId: string;
  seats: number;
  email: string;
}

export class InvalidOrderError extends Error {
  override name = 'InvalidOrderError';
}

// Checks the message body. Errors here are permanent:
// retrying the same message will never fix them.
export function parseOrder(body: string): TicketOrder {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new InvalidOrderError('Body is not valid JSON');
  }
  if (typeof data !== 'object' || data === null) {
    throw new InvalidOrderError('Body is not an object');
  }
  const o = data as Record<string, unknown>;
  if (typeof o.orderId !== 'string' || o.orderId === '') {
    throw new InvalidOrderError('orderId is missing');
  }
  if (typeof o.eventId !== 'string' || o.eventId === '') {
    throw new InvalidOrderError('eventId is missing');
  }
  if (!Number.isInteger(o.seats) || (o.seats as number) < 1 || (o.seats as number) > 10) {
    throw new InvalidOrderError('seats must be between 1 and 10');
  }
  if (typeof o.email !== 'string' || !o.email.includes('@')) {
    throw new InvalidOrderError('email is invalid');
  }
  return { orderId: o.orderId, eventId: o.eventId, seats: o.seats as number, email: o.email };
}
