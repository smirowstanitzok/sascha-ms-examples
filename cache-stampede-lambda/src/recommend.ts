// src/recommend.ts
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { required } from "./valkey-store.js";

const bedrock = new BedrockRuntimeClient({});

const SYSTEM_PROMPT = `You write the "pick of the day" for the fictional bookshop "Seitenwind".
Recommend one well-known, real book for the given genre in at most 80 words.
Do not invent prices, stock levels or quotes.`;

/** The expensive call we want to protect: takes seconds and costs tokens. */
export async function writeRecommendation(genre: string): Promise<string> {
  const response = await bedrock.send(
    new ConverseCommand({
      modelId: required("MODEL_ID"),
      system: [{ text: SYSTEM_PROMPT }],
      messages: [{ role: "user", content: [{ text: `Genre: ${genre}` }] }],
      inferenceConfig: { maxTokens: 300, temperature: 0.7 },
    }),
  );
  const text = (response.output?.message?.content ?? [])
    .map((block) => block.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Empty answer from the model");
  return text;
}
