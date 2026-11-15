# Prevent a cache stampede with Lambda, Valkey and Bedrock

Example code for the article:

- English: [Prevent a cache stampede: Lambda, Valkey and Bedrock](https://sascha-ms.de/en/cache-stampede-lambda-valkey)
- German: [Cache Stampede verhindern: Lambda, Valkey und Bedrock](https://sascha-ms.de/2026/3135-cache-stampede-verhindern)

A fictional bookshop shows a "pick of the day" per genre, written by Amazon Bedrock and cached in ElastiCache Serverless for Valkey. When the entry expires, only the request that wins a short `SET NX PX` lock calls the model. Everyone else gets the stale value or waits briefly. XFetch (probabilistic early refresh) and TTL jitter spread the recomputations.

## Files

| File | Purpose |
| --- | --- |
| `src/stampede.ts` | `getOrCompute()`: lock, stale value, XFetch, jitter – no AWS dependency |
| `src/valkey-store.ts` | GLIDE cluster client with IAM auth and TLS, `SET NX PX`, safe release via Lua script |
| `src/recommend.ts` | Bedrock Converse API call (the expensive part) |
| `src/handler.ts` | Lambda handler behind an HTTP API (`GET /picks/{genre}`), 503 + `Retry-After` while busy |
| `lib/bookshop-picks-stack.ts` | AWS CDK stack: function, IAM permissions, HTTP API |
| `bin/app.ts` | CDK app |
| `test/memory-store.ts` | In-memory store with `SET NX PX` semantics for tests |
| `test/*.test.ts` | Vitest tests without AWS (incl. 50 parallel requests → 1 computation) |

## Run

```bash
npm install
npx tsc --noEmit
npm test          # 15 tests, no AWS access needed

# with AWS credentials, Docker and a Valkey serverless cache with public endpoint + IAM auth
export CDK_DEFAULT_REGION=eu-central-1
npx cdk deploy -c cacheName=bookshop-cache -c cacheHost=<your-cache-endpoint>

API=<ApiUrl from the output>
seq 50 | xargs -P 50 -I{} curl -s "$API/picks/crime" | grep -o '"source":"[a-z]*"' | sort | uniq -c
```

## Tested with

Node.js 22, TypeScript 5.9, Vitest 5.1.0, aws-cdk-lib 2.277.0, @valkey/valkey-glide 2.6.0, @aws-sdk/client-bedrock-runtime 3.1169.0. Type check, unit tests and stack assertions pass; the Valkey adapter was additionally tested against a local Redis OSS cluster. The AWS deployment was not run against a live account.
