// src/order-workflow.ts
import { withDurableExecution, type DurableContext } from "@aws/durable-execution-sdk-js";

interface OrderEvent {
  orderId: string;
  amountCents: number;
}

// Placeholders for the real calls to warehouse, payment provider and mail service.
const reserveBooks = async (orderId: string) => ({ reservationId: `res-${orderId}` });
const chargePayment = async (orderId: string, amountCents: number) => ({
  paymentId: `pay-${orderId}-${amountCents}`,
});
const sendConfirmation = async (orderId: string) => ({ sent: true, orderId });

export const handler = withDurableExecution(async (event: OrderEvent, context: DurableContext) => {
  // Each step is a checkpoint. A pause takes effect at the next one.
  const reservation = await context.step("reserve-books", async () => reserveBooks(event.orderId));
  const payment = await context.step("charge-payment", async () =>
    chargePayment(event.orderId, event.amountCents),
  );
  await context.wait({ seconds: 30 });
  await context.step("send-confirmation", async () => sendConfirmation(event.orderId));
  return { orderId: event.orderId, reservation, payment };
});
