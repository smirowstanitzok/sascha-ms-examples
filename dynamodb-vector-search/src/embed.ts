// src/embed.ts
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({});
const MODEL_ID = process.env.EMBEDDING_MODEL_ID ?? 'amazon.titan-embed-text-v2:0';

// Must match "Dimensions" of the vector index exactly
export const DIMENSIONS = 512;

export async function embed(text: string): Promise<number[]> {
  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        inputText: text.slice(0, 20_000), // Titan V2 accepts at most 8,192 tokens
        dimensions: DIMENSIONS,
        normalize: true,
      }),
    }),
  );
  const { embedding } = JSON.parse(new TextDecoder().decode(response.body)) as { embedding: number[] };
  if (embedding.length !== DIMENSIONS) {
    throw new Error(`Embedding has ${embedding.length} instead of ${DIMENSIONS} dimensions`);
  }
  return embedding;
}
