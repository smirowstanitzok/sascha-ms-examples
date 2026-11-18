// src/chat.ts
import { BedrockAgentCoreClient } from "@aws-sdk/client-bedrock-agentcore";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { assertId, customerHistory, recentTurns, recordTurn } from "./memory.ts";
import { buildSystemPrompt, toConverseMessages } from "./prompt.ts";
import { customerIdFrom, json, requireEnv, type HttpEvent } from "./http.ts";

const memory = new BedrockAgentCoreClient({});
const bedrock = new BedrockRuntimeClient({});

export const handler = async (event: HttpEvent) => {
  let customerId: string;
  try {
    customerId = customerIdFrom(event);
  } catch {
    return json(401, { error: "unauthenticated" });
  }

  let body: any;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "body must be JSON" });
  }
  let sessionId: string;
  try {
    sessionId = assertId(body.sessionId, "sessionId");
  } catch {
    return json(400, { error: "sessionId must match [A-Za-z0-9_-]{1,100}" });
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
  if (!message) return json(400, { error: "message is required" });

  const memoryId = requireEnv("MEMORY_ID");

  // Read before writing, so the new message is not duplicated in the context.
  const [turns, history] = await Promise.all([
    recentTurns(memory, memoryId, customerId, sessionId, 10),
    customerHistory(memory, memoryId, customerId, 3),
  ]);

  // Opt-in flag from the client: e.g. a message containing an address.
  const skipExtraction = body.sensitive === true;
  await recordTurn(memory, memoryId, customerId, sessionId, { role: "USER", text: message }, { skipExtraction });

  const response = await bedrock.send(
    new ConverseCommand({
      modelId: requireEnv("MODEL_ID"),
      system: [{ text: buildSystemPrompt(history, sessionId) }],
      messages: toConverseMessages(turns, message),
      inferenceConfig: { maxTokens: 600, temperature: 0.3 },
    }),
  );
  const reply = response.output?.message?.content?.find((block) => block.text)?.text ?? "";

  await recordTurn(memory, memoryId, customerId, sessionId, { role: "ASSISTANT", text: reply });
  return json(200, { reply });
};
