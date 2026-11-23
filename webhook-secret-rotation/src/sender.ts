// src/sender.ts
import { randomUUID } from "node:crypto";
import { signWebhook } from "./signature.ts";
import { activeSecrets, loadSigningKeys } from "./keys.ts";

const PARAM = process.env.SECRET_PARAM!;
const TARGET_URL = process.env.TARGET_URL!;

type RentalCompleted = { rentalId: string; bikeId: string; minutes: number };

// Bike rental: reports completed rentals to a partner
export async function handler(event: RentalCompleted): Promise<{ status: number }> {
  const body = JSON.stringify({ type: "rental.completed", data: event });
  const msgId = `msg_${randomUUID()}`;
  const timestamp = Math.floor(Date.now() / 1000);

  // Two signatures during the overlap, one otherwise
  const keys = await loadSigningKeys(PARAM);
  const signature = signWebhook(activeSecrets(keys), msgId, timestamp, body);

  const res = await fetch(TARGET_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": msgId,
      "webhook-timestamp": String(timestamp),
      "webhook-signature": signature,
    },
    body,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`partner answered ${res.status}`);
  return { status: res.status };
}
