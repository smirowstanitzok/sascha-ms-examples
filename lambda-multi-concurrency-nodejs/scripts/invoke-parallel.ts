// scripts/invoke-parallel.ts
// Invokes the deployed function 100 times concurrently and checks that every response
// belongs to its own order. Usage: npx tsx scripts/invoke-parallel.ts <function-name>
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';

const functionName = process.argv[2] ?? 'ticket-shop-receipts-dev-createReceipt';
const client = new LambdaClient({});
const n = 100;

async function invoke(i: number) {
  const order = { orderId: `order-${i}`, customerId: `customer-${i}`, seats: [{ category: 'circle', count: i + 1 }] };
  const res = await client.send(new InvokeCommand({
    FunctionName: functionName,
    Payload: Buffer.from(JSON.stringify(order)),
  }));
  const body = JSON.parse(Buffer.from(res.Payload ?? []).toString('utf8'));
  if (res.FunctionError) return { i, ok: false, reason: `error: ${body.errorMessage}` };
  const ok = body.orderId === order.orderId && body.customerId === order.customerId && body.totalCents === 4900 * (i + 1);
  return { i, ok, reason: ok ? '' : `received: ${body.orderId}/${body.customerId}/${body.totalCents}` };
}

const results = await Promise.all(Array.from({ length: n }, (_, i) => invoke(i)));
const broken = results.filter((r) => !r.ok);
for (const r of broken.slice(0, 10)) console.log(`invocation ${r.i}: ${r.reason}`);
console.log(`${n - broken.length} of ${n} responses correct.`);
process.exitCode = broken.length === 0 ? 0 : 1;
