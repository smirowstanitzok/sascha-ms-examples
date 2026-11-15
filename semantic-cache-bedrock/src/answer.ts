// src/answer.ts
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { required } from "./valkey";

const bedrock = new BedrockRuntimeClient({});

const SYSTEM_PROMPT = `You are the FAQ assistant of the fictional “Lindenau Bike Station”, a bike rental.
Answer briefly, kindly and only with general information.
Never mention data about individual customers and never make up prices.`;

export interface ModelAnswer {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/** Asks the language model via the Converse API. */
export async function askModel(question: string): Promise<ModelAnswer> {
  const response = await bedrock.send(
    new ConverseCommand({
      modelId: required("MODEL_ID"),
      system: [{ text: SYSTEM_PROMPT }],
      messages: [{ role: "user", content: [{ text: question }] }],
      inferenceConfig: { maxTokens: 400, temperature: 0.2 },
    }),
  );
  const text = (response.output?.message?.content ?? [])
    .map((block) => block.text ?? "")
    .join("")
    .trim();
  return {
    text,
    inputTokens: response.usage?.inputTokens ?? 0,
    outputTokens: response.usage?.outputTokens ?? 0,
  };
}
