// src/shop.ts
// Business logic of the fictional ticket shop – stateless, so nothing to worry about.
export interface OrderEvent {
  orderId: string;
  customerId: string;
  seats: { category: 'stalls' | 'circle' | 'box'; count: number }[];
}

export type PriceList = Record<OrderEvent['seats'][number]['category'], number>;

export interface Receipt {
  orderId: string;
  customerId: string;
  totalCents: number;
  requestId: string;
  file: string;
}

// Simulates a slow call, e.g. to a database or a third-party system
export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let priceListLoads = 0; // for the tests only: counts how often the price list was loaded

export async function loadPriceList(): Promise<PriceList> {
  priceListLoads++;
  await pause(30);
  return { stalls: 6900, circle: 4900, box: 12900 };
}

export const priceListLoadCount = () => priceListLoads;
export const resetPriceListLoadCount = () => { priceListLoads = 0; };

export function totalCents(order: OrderEvent, prices: PriceList): number {
  return order.seats.reduce((sum, seat) => sum + prices[seat.category] * seat.count, 0);
}
