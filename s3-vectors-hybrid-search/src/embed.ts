// src/embed.ts
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({});
const modelId = process.env.EMBEDDING_MODEL_ID ?? 'amazon.titan-embed-text-v2:0';

// Creates a vector with 1024 dimensions to match the index.
export async function embed(text: string): Promise<number[]> {
  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({ inputText: text, dimensions: 1024, normalize: true }),
    }),
  );
  const payload = JSON.parse(new TextDecoder().decode(response.body)) as { embedding: number[] };
  return payload.embedding;
}
