// scripts/setup-index.ts
import { GlideFt } from "@valkey/valkey-glide";
import { getClient } from "../src/valkey";
import { EMBEDDING_DIM } from "../src/embed";
import { INDEX_NAME, KEY_PREFIX } from "../src/semantic-cache";

async function main(): Promise<void> {
  const client = await getClient();
  const existing = (await GlideFt.list(client)).map(String);
  if (existing.includes(INDEX_NAME)) {
    console.log(`Index ${INDEX_NAME} already exists`);
  } else {
    await GlideFt.create(
      client,
      INDEX_NAME,
      [
        { type: "TAG", name: "topic" },
        { type: "TAG", name: "kbv" },
        { type: "TAG", name: "bike" },
        {
          type: "VECTOR",
          name: "embedding",
          attributes: { algorithm: "HNSW", dimensions: EMBEDDING_DIM, distanceMetric: "COSINE", type: "FLOAT32" },
        },
      ],
      { dataType: "HASH", prefixes: [KEY_PREFIX] },
    );
    console.log(`Index ${INDEX_NAME} created`);
  }
  client.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
