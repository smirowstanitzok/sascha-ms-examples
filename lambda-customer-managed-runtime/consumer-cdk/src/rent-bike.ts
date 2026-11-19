// src/rent-bike.ts
import { createLogger } from '@radwerk/logger';

const log = createLogger('rental');

interface RentRequest {
  bikeId: string;
  customerId: string;
}

export const handler = async (event: RentRequest) => {
  if (!event.bikeId || !event.customerId) {
    log.warn('incomplete request', { event });
    return { statusCode: 400, body: 'bikeId and customerId are required' };
  }

  log.info('bike rented', { bikeId: event.bikeId, customerId: event.customerId });
  return { statusCode: 200, body: JSON.stringify({ rented: event.bikeId }) };
};
