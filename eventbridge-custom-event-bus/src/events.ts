// src/events.ts
import { z } from 'zod';

export const EVENT_SOURCE = 'radwerk.rental';
export const BIKE_RETURNED = 'BikeReturned';

// Business payload of the event (ends up in the "detail" field)
export const bikeReturnedSchema = z.object({
  returnId: z.string().min(1).max(128),
  bikeId: z.string().min(1),
  customerId: z.string().min(1).max(128),
  rideKm: z.number().nonnegative(),
  kmSinceService: z.number().nonnegative(),
  minutes: z.number().int().positive(),
  returnedAt: z.iso.datetime(),
});
export type BikeReturned = z.infer<typeof bikeReturnedSchema>;

// This is how an event published with PutEvents reaches the target
// (RAW transformer): the classic envelope, with the payload in "detail".
export const bikeReturnedEnvelopeSchema = z.object({
  id: z.string(),
  source: z.literal(EVENT_SOURCE),
  'detail-type': z.literal(BIKE_RETURNED),
  time: z.string(),
  detail: bikeReturnedSchema,
});
export type BikeReturnedEnvelope = z.infer<typeof bikeReturnedEnvelopeSchema>;
