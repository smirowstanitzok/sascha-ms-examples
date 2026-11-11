// src/embed.ts
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

export const EMBEDDING_DIM = 512;
const bedrock = new BedrockRuntimeClient({});

/** Creates a normalized embedding with Titan Text Embeddings V2. */
export async function embed(text: string): Promise<number[]> {
  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: "amazon.titan-embed-text-v2:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({ inputText: text, dimensions: EMBEDDING_DIM, normalize: true }),
    }),
  );
  const parsed = JSON.parse(new TextDecoder().decode(response.body)) as { embedding: number[] };
  return parsed.embedding;
}
