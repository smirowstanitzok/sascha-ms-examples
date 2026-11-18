# DynamoDB caching with ElastiCache Serverless and Lambda

Example code for the article:

- English: [DynamoDB caching with ElastiCache Serverless and Lambda](https://sascha-ms.de/en/dynamodb-caching-elasticache-serverless-lambda)
- German: [DynamoDB Caching mit ElastiCache Serverless und Lambda](https://sascha-ms.de/2026/3569-dynamodb-caching-elasticache-serverless)

A small book catalog API for a fictional city library. Three Lambda functions read and write a DynamoDB table; the
ElastiCache integration client routes the calls through an ElastiCache Serverless for Valkey cache with the DynamoDB
integration enabled (write-through, sub-millisecond reads, automatic fallback to DynamoDB).

## Files

| File | Purpose |
| --- | --- |
| `src/catalog-client.ts` | Creates the DynamoDB client once and attaches the cache with `install()` |
| `src/books.ts` | HTTP handlers: get a book, list books by author (`?fresh=true` = strongly consistent), create/update a book |
| `serverless.yml` | Serverless Framework v4: functions in a VPC, DynamoDB table, IAM incl. `elasticache:Connect`, DynamoDB gateway endpoint |
| `tsconfig.json` | Type checking only, Serverless Framework v4 bundles with esbuild |

## Run it

The cache itself is created with the AWS CLI (the DynamoDB integration can only be enabled at creation time and needs Valkey 9+):

```bash
aws elasticache create-serverless-cache \
  --serverless-cache-name library-catalog-cache \
  --engine valkey --major-engine-version 9 \
  --integrations IntegrationType=DYNAMODB \
  --user-group-id default.iam-user-group \
  --subnet-ids <subnet-a> <subnet-b> \
  --security-group-ids <cache-sg> \
  --cache-usage-limits 'DataStorage={Maximum=5,Unit=GB},ECPUPerSecond={Maximum=5000}'

npm install
npm run typecheck
serverless deploy --stage dev \
  --param="cacheName=library-catalog-cache" \
  --param="cacheEndpoint=<cache-endpoint>:6379" \
  --param="lambdaSecurityGroupId=<lambda-sg>" \
  --param="subnetA=<subnet-a>" --param="subnetB=<subnet-b>" \
  --param="vpcId=<vpc-id>" --param="routeTableId=<route-table-id>"
```

The cache security group must allow TCP 6379-6380 from the Lambda security group. See the article for all steps,
expected output and common mistakes. Delete the cache and run `serverless remove` when you are done – an
ElastiCache Serverless cache is billed even when idle.

## Tested with

- Node.js 22, TypeScript 7.0.2 (`tsc --noEmit`)
- @aws-sdk/aws-elasticache-integration-client 1.0.0, @aws-sdk/client-dynamodb 3.1171.0
- Serverless Framework v4 (configuration not deployed during testing)
