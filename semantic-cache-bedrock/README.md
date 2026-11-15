# Semantic cache for Amazon Bedrock with ElastiCache Serverless and Lambda

Example code for the article:

- English: [Semantic cache for Bedrock with ElastiCache and Lambda](https://sascha-ms.de/en/semantic-cache-bedrock)
- German: [Semantischer Cache für Bedrock mit ElastiCache und Lambda](https://sascha-ms.de/2026/3090-semantischer-cache-bedrock)

A FAQ assistant for a fictional bike rental answers questions with Amazon Bedrock. Answers are cached on two levels in ElastiCache Serverless for Valkey: an exact level (hash of the normalized question) and a semantic level (KNN vector search with hard TAG filters for topic, knowledge version and bike type). Personal or time-sensitive questions bypass the cache.

## Files

| File | Purpose |
| --- | --- |
| `src/valkey.ts` | GLIDE cluster client with IAM authentication and TLS |
| `src/embed.ts` | Titan Text Embeddings V2 (512 dimensions) and FLOAT32 buffer |
| `src/policy.ts` | Pure rules: normalization, cacheability, bike type, exact key, lookup query, hit check, TTL jitter |
| `src/semantic-cache.ts` | Exact lookup, filtered KNN lookup and storing both levels with TTL |
| `src/answer.ts` | Bedrock Converse API call |
| `src/metrics.ts` | CloudWatch Embedded Metric Format per source |
| `src/handler.ts` | Lambda handler behind an HTTP API (`POST /question`) |
| `scripts/setup-index.ts` | Creates the vector index `idx:answers` |
| `scripts/calibrate.ts` | Prints cosine distances for labeled question pairs |
| `test/*.test.ts` | Vitest tests without AWS |
| `serverless.yml` | Serverless Framework v4 deployment without VPC |

## Run

```bash
npm install
npm test          # 17 tests, no AWS access needed
npx tsc --noEmit

# with AWS credentials and a Valkey 9 serverless cache with public endpoint
export AWS_REGION=eu-central-1
export CACHE_NAME=bike-station-cache
export CACHE_HOST=<your-cache-endpoint>
npm run setup-index
npm run calibrate
npm run deploy
```

## Tested with

Node.js 24, TypeScript 7.0.2, Vitest 5.1.0, @valkey/valkey-glide 2.6.0, @aws-sdk/client-bedrock-runtime 3.1169.0 (type check and unit tests; the AWS calls were not run against a live account).
