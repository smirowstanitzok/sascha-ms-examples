# S3 Vectors hybrid search: RAG with Lambda and TypeScript

Hybrid search (vector plus full text) with Amazon S3 Vectors for the help center of a fictional bike shop ("Radwerk"): an ingest function embeds help articles with Amazon Titan Text Embeddings V2 and writes them to a vector index, a search function behind an HTTP API combines semantic and keyword matches. Includes a small reciprocal rank fusion (RRF) helper and tests for the query builder.

- Article (English): [S3 Vectors hybrid search: RAG with Lambda and TypeScript](https://sascha-ms.de/en/s3-vectors-hybrid-search)
- Article (German): [S3 Vectors Hybridsuche: RAG mit Lambda und TypeScript](https://sascha-ms.de/2026/3504-s3-vectors-hybridsuche)

## Files

| File | Purpose |
| --- | --- |
| `serverless.yml` | Vector bucket, index, ingest and search functions, HTTP API (Serverless Framework v4) |
| `src/embed.ts` | Creates embeddings with Bedrock (Titan Text Embeddings V2) |
| `src/ingest.ts` | Writes help articles with metadata to the vector index |
| `src/query.ts` | Builds the QueryVectors input for hybrid search |
| `src/search.ts` | Lambda handler for `GET /search?q=...` |
| `src/rrf.ts` | Reciprocal rank fusion to merge two result lists yourself |
| `scripts/enable-text-search.ts` | Enables full-text search on the index (not yet available in CloudFormation) |
| `data/help-articles.json` | Sample help articles |
| `test/query.test.ts` | Tests with the built-in Node.js test runner |

## Run it

```bash
npm install
npm run typecheck
npm test
```

Deploy and fill the index:

```bash
serverless deploy
export VECTOR_BUCKET=radwerk-help-dev-$(aws sts get-caller-identity --query Account --output text)
export VECTOR_INDEX=help-articles
npm run enable-text-search
serverless invoke -f ingest --path data/help-articles.json
```

Deploying creates real resources (S3 vector bucket and index, Lambda, API Gateway) and Bedrock embedding calls cost money. Remove everything with `serverless remove`.

## Tested with

Node.js 22.6+ (type stripping), TypeScript 5.9, AWS SDK v3.1170 (type check and 6 tests passed).
