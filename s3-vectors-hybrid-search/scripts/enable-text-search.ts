// scripts/enable-text-search.ts
import {
  S3VectorsClient,
  GetIndexCommand,
  UpdateIndexModeCommand,
  UpdateMetadataConfigurationCommand,
} from '@aws-sdk/client-s3vectors';

const vectorBucketName = process.env.VECTOR_BUCKET;
const indexName = process.env.VECTOR_INDEX ?? 'help-articles';
if (!vectorBucketName) {
  throw new Error('Please set VECTOR_BUCKET');
}

const client = new S3VectorsClient({});
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const { index } = await client.send(new GetIndexCommand({ vectorBucketName, indexName }));

// Full-text search is only available in ENHANCED mode.
if (index?.indexMode === 'CLASSIC') {
  console.log('Index is CLASSIC, switching to ENHANCED …');
  await client.send(new UpdateIndexModeCommand({ vectorBucketName, indexName, indexMode: 'ENHANCED' }));
}

const configured = new Set(
  (index?.metadataConfiguration?.textSearchConfigurations ?? []).map((c) => c.metadataKey),
);

// All fields in ONE request, S3 Vectors rejects parallel updates.
const wanted = [
  { metadataKey: 'title' },
  { metadataKey: 'body', language: 'en' as const },
].filter((c) => !configured.has(c.metadataKey));

if (wanted.length > 0) {
  await client.send(
    new UpdateMetadataConfigurationCommand({
      vectorBucketName,
      indexName,
      add: { textSearchConfigurations: wanted },
    }),
  );
  console.log(`Full-text search requested for: ${wanted.map((c) => c.metadataKey).join(', ')}`);
}

// Wait until no field reports BUILDING anymore.
for (;;) {
  const { index: current } = await client.send(new GetIndexCommand({ vectorBucketName, indexName }));
  const fields = current?.metadataConfiguration?.textSearchConfigurations ?? [];
  console.log(fields.map((f) => `${f.metadataKey}=${f.status}`).join(' '));
  if (fields.length > 0 && fields.every((f) => f.status === 'ACTIVE')) break;
  await sleep(10_000);
}
console.log('Done: hybrid search is ready.');
