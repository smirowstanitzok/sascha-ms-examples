// scripts/setup-index.ts
import { GlideFt } from "@valkey/valkey-glide";
import { getClient } from "../src/valkey";
import { embed, EMBEDDING_DIM } from "../src/embed";
import { toVectorBuffer } from "../src/query";
import { INDEX_NAME } from "../src/handler";

const books = [
  { id: "b1", title: "Fog over the Harbour", author: "Lena Brandt", genre: "crime", year: 2019,
    description: "A detective investigates in a port city where a container full of stolen paintings disappears." },
  { id: "b2", title: "The Last Train North", author: "Tom Weller", genre: "crime", year: 2011,
    description: "A murder on the night train, seven suspects and a conductor who knows more than he admits." },
  { id: "b3", title: "Gardening in Small Spaces", author: "Mira Holm", genre: "nonfiction", year: 2022,
    description: "A practical guide to vegetables, herbs and berries on balconies and windowsills." },
  { id: "b4", title: "The Map of Winds", author: "Jonas Reiter", genre: "fantasy", year: 2020,
    description: "A young cartographer discovers that her maps control the weather of an entire kingdom." },
  { id: "b5", title: "Summer in the Lighthouse", author: "Clara Wendt", genre: "novel", year: 2018,
    description: "Two sisters inherit a lighthouse on the coast and have to decide whether to stay." },
  { id: "b6", title: "Fritz and the Lost Bicycle", author: "Ida Kern", genre: "children", year: 2023,
    description: "A boy and his dog search for a stolen bicycle and get to know the whole neighbourhood." },
];

async function main(): Promise<void> {
  const client = await getClient();

  const existing = (await GlideFt.list(client)).map(String);
  if (!existing.includes(INDEX_NAME)) {
    await GlideFt.create(
      client,
      INDEX_NAME,
      [
        { type: "TEXT", name: "title" },
        { type: "TEXT", name: "description", nostem: true },
        { type: "TAG", name: "genre" },
        { type: "NUMERIC", name: "year" },
        {
          type: "VECTOR",
          name: "embedding",
          attributes: { algorithm: "HNSW", dimensions: EMBEDDING_DIM, distanceMetric: "COSINE", type: "FLOAT32" },
        },
      ],
      { dataType: "HASH", prefixes: ["book:"] },
    );
    console.log(`Index ${INDEX_NAME} created`);
  }

  for (const book of books) {
    const vector = await embed(`${book.title}. ${book.description}`);
    await client.hset(`book:${book.id}`, [
      { field: "title", value: book.title },
      { field: "author", value: book.author },
      { field: "genre", value: book.genre },
      { field: "year", value: String(book.year) },
      { field: "description", value: book.description },
      { field: "embedding", value: toVectorBuffer(vector) },
    ]);
    console.log(`stored: ${book.title}`);
  }
  client.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
