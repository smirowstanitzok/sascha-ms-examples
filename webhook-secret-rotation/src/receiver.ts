// src/receiver.ts
import type { LambdaFunctionURLEvent, LambdaFunctionURLResult } from "aws-lambda";
import { verifyWebhook } from "./signature.ts";
import { activeSecrets, loadSigningKeys } from "./keys.ts";

const PARAM = process.env.SECRET_PARAM!;

export async function handler(event: LambdaFunctionURLEvent): Promise<LambdaFunctionURLResult> {
  const body = event.isBase64Encoded
    ? Buffer.from(event.body ?? "", "base64").toString("utf8")
    : (event.body ?? "");
  const h = event.headers ?? {};

  const keys = await loadSigningKeys(PARAM);
  const result = verifyWebhook({
    secrets: activeSecrets(keys),
    msgId: h["webhook-id"],
    timestamp: h["webhook-timestamp"],
    signatureHeader: h["webhook-signature"],
    body,
  });

  if (!result.ok) {
    console.warn(JSON.stringify({ msg: "webhook rejected", reason: result.reason }));
    return { statusCode: 401, body: "invalid signature" };
  }

  // Important for the switch-over: see which secret is still in use
  console.log(
    JSON.stringify({
      msg: "webhook accepted",
      webhookId: h["webhook-id"],
      matchedKey: result.matchedKeyIndex === 0 ? "current" : "previous",
    }),
  );
  return { statusCode: 204 };
}
