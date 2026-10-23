type Order = { id: string; amount: number };

export async function sumOrders(
  source: AsyncIterable<Order>,
): Promise<number> {
  const all = await Array.fromAsync(source);
  return Math.sumPrecise(all.map((b) => b.amount));
}

export function countPerCustomer(customers: string[]): Map<string, number> {
  const counter = new Map<string, number>();
  for (const k of customers) {
    counter.set(k, counter.getOrInsert(k, 0) + 1);
  }
  return counter;
}
