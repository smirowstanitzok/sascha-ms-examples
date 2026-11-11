// src/handler.ts
import { BedrockAgentCoreClient } from "@aws-sdk/client-bedrock-agentcore";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { answerWithSources, type AgentAnswer } from "./agent";
import { searchWeb } from "./web-search";

// Created once per execution environment and reused across invocations.
const agentCore = new BedrockAgentCoreClient({ maxAttempts: 4 });
const runtime = new BedrockRuntimeClient({});

const modelId = process.env.MODEL_ID ?? "";
const trustedDomains = (process.env.TRUSTED_DOMAINS ?? "")
  .split(",")
  .map((domain) => domain.trim())
  .filter(Boolean);

export const handler = async (event: { question?: string }): Promise<AgentAnswer> => {
  const question = event.question?.trim();
  if (!question || question.length > 1000) {
    throw new Error("Please send a question with 1 to 1000 characters.");
  }
  const result = await answerWithSources(question, {
    runtime,
    modelId,
    trustedDomains,
    search: (opts) => searchWeb(agentCore, opts),
  });
  console.log(JSON.stringify({ searches: result.searches, sources: result.sources.length }));
  return result;
};
