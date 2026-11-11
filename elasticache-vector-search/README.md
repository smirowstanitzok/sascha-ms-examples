# ElastiCache vector search: hybrid search from Lambda

Example code for the article [ElastiCache vector search: hybrid search from Lambda](https://sascha-ms.de/en/elasticache-vector-search-lambda) ([German version](https://sascha-ms.de/2026/2690-elasticache-vektorsuche-lambda)).

A small book search for a fictional city library: embeddings from Amazon Bedrock (Titan Text Embeddings V2), a Valkey search index in ElastiCache Serverless with a public endpoint (IAM + TLS 1.3), and a Lambda function behind an HTTP API, deployed with the Serverless Framework v4 and no VPC.

## Files

| File | Purpose |
| --- | --- |
| `src/valkey.ts` | Valkey GLIDE cluster client with IAM authentication |
| `src/embed.ts` | Embeddings with Titan Text Embeddings V2 (512 dimensions) |
| `src/query.ts` | Builds the hybrid query (pre-filter + KNN) and the vector buffer |
| `src/handler.ts` | Lambda handler for `GET /search` |
| `scripts/setup-index.ts` | Creates the index `idx:books` and stores sample books |
| `test/query.test.ts` | Vitest tests for the query builder |
| `serverless.yml` | Serverless Framework v4 service without a VPC |

## Run

```bash
# 1. Create the serverless cache with a public endpoint (Valkey 9)
aws elasticache create-serverless-cache --serverless-cache-name book-search --engine valkey --major-engine-version 9 --connection-type public --user-group-id default.iam-user-group --region eu-central-1

# 2. Install and test
npm install
npm test

# 3. Create the index and sample data
export AWS_REGION=eu-central-1
export CACHE_NAME=book-search
export CACHE_HOST=<endpoint address of your cache>
npm run setup-index

# 4. Deploy (on Linux, e.g. in CI)
npm run deploy

# Clean up
serverless remove
aws elasticache delete-serverless-cache --serverless-cache-name book-search --region eu-central-1
```

On macOS, build first and then run `npm install --os=linux --cpu=x64` before `serverless deploy`, because GLIDE ships a native library.

Checked with: TypeScript 7.0.2, Vitest 5.1.0, @valkey/valkey-glide 2.6.0, @aws-sdk/client-bedrock-runtime 3.1166.0, Node.js 22/24. `tsc --noEmit` and the tests pass; the AWS parts need an AWS account.
