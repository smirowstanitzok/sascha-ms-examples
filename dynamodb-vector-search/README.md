# DynamoDB Vector Search: Semantic Search with Lambda

Example code for the article:

- English: [DynamoDB Vector Search: Semantic Search with Lambda](https://sascha-ms.de/en/dynamodb-vector-search-lambda)
- German: [DynamoDB Vektorsuche: Semantische Suche mit Lambda](https://sascha-ms.de/2026/4102-dynamodb-vektorsuche-lambda)

A fictional bookshop stores its books in DynamoDB. One Lambda function creates an embedding with Amazon Titan Text Embeddings V2 (512 dimensions) and writes the book with its vector. A second function turns a free-text query into an embedding and calls `SearchVectors` on a DynamoDB vector index, scoped by `genre` (vector index partition key) and filtered by language (`IN`), maximum price (`<=`) and minimum year (`>=`).

## Files

| Path | Purpose |
| --- | --- |
| `serverless.yml` | Serverless Framework v4: table with vector index, two HTTP functions, one IAM role per function |
| `src/book.ts` | Book type, input validation, text used for the embedding |
| `src/embed.ts` | Calls Titan Text Embeddings V2 via Amazon Bedrock |
| `src/add-book.ts` | `POST /books`: creates the embedding and stores the item |
| `src/search-request.ts` | Builds the `SearchVectors` request including `SearchConditionExpression` |
| `src/search-books.ts` | `GET /search`: embeds the query and runs the vector search |
| `test/search-request.test.ts` | Local tests for the request builder (no AWS needed) |
| `scripts/seed.ts` | Loads five made-up books through the API |
| `cdk/` | The same table and vector index with AWS CDK (`CfnTable`) |

## Run

```bash
npm install
npm test            # three local tests (Node.js 22.18+ runs TypeScript directly)
npm run typecheck
serverless deploy   # needs Bedrock access to amazon.titan-embed-text-v2:0 in eu-central-1
API_URL=https://<your-api-id>.execute-api.eu-central-1.amazonaws.com npm run seed
curl "https://<your-api-id>.execute-api.eu-central-1.amazonaws.com/search?q=gripping%20case%20on%20the%20coast&genre=crime&lang=de,en&maxPrice=20"
```

CDK variant:

```bash
cd cdk
npm install
npx cdk synth       # warning E3039 about AttributeDefinitions is expected, see article
```

## Checked versions

- Node.js 22
- `@aws-sdk/client-dynamodb` 3.1178.0, `@aws-sdk/client-bedrock-runtime` 3.1178.0, `@aws-sdk/util-dynamodb` 3.996.9
- `aws-cdk-lib` 2.278.0 (`cdk synth` checked)
- Serverless Framework 4.47 (`serverless.yml` not deployed in this check)
