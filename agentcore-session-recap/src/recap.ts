// src/recap.ts
import { BedrockAgentCoreClient } from "@aws-sdk/client-bedrock-agentcore";
import { assertId, customerHistory, sessionRecap } from "./memory.ts";
import { clientError, customerIdFrom, json, requireEnv, type HttpEvent } from "./http.ts";

const memory = new BedrockAgentCoreClient({});

// GET /sessions/{sessionId}/recap – recap of a single conversation
export const session = async (event: HttpEvent) => {
  try {
    const customerId = customerIdFrom(event);
    const sessionId = assertId(event.pathParameters?.sessionId, "sessionId");
    const recap = await sessionRecap(memory, requireEnv("MEMORY_ID"), customerId, sessionId);
    // Summaries are created asynchronously, so "not yet" is a normal state.
    return recap ? json(200, { sessionId, recap }) : json(404, { error: "no recap yet" });
  } catch (error) {
    return clientError(error);
  }
};

// GET /history – the latest recaps of one customer, newest first
export const history = async (event: HttpEvent) => {
  try {
    const customerId = customerIdFrom(event);
    const entries = await customerHistory(memory, requireEnv("MEMORY_ID"), customerId, 10);
    return json(200, { entries });
  } catch (error) {
    return clientError(error);
  }
};
