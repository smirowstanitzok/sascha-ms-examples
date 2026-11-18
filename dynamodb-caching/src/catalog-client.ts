// src/catalog-client.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  ElastiCacheIntegrationsError,
  install,
} from "@aws-sdk/aws-elasticache-integration-client";

export const BOOKS_TABLE = process.env.BOOKS_TABLE ?? "";

// One client per execution environment, reused across invocations
export const dynamodb = new DynamoDBClient({ maxAttempts: 3 });

let cacheActive = false;

async function enableCache(): Promise<void> {
  const endpoint = process.env.CACHE_ENDPOINT;
  const cacheName = process.env.CACHE_NAME;
  if (!endpoint || !cacheName) {
    console.warn("CACHE_ENDPOINT or CACHE_NAME missing – running without cache");
    return;
  }
  try {
    await install({
      client: dynamodb,
      endpoint, // format host:port, e.g. xyz.serverless.euc1.cache.amazonaws.com:6379
      cacheName,
      clientConfiguration: {
        connectionTimeout: 1_000, // in Lambda, wait briefly and fall back to DynamoDB
        cacheRequestTimeout: 500,
        cachePolicyOverrides: {
          cached_tables: [BOOKS_TABLE], // only this table goes through the cache
          item_ttl: 300, // seconds
          item_negative_ttl: 30,
          query_ttl: 60,
        },
      },
    });
    cacheActive = true;
  } catch (error) {
    if (!(error instanceof ElastiCacheIntegrationsError)) throw error;
    // The client stays unchanged and talks to DynamoDB directly
    console.warn(`Starting without cache: ${error.message}`);
  }
}

// Start during the init phase so connecting does not slow down the first request
export const cacheReady: Promise<void> = enableCache();

export const isCacheActive = (): boolean => cacheActive;
