// src/collect-results.ts
// Invoked by EventBridge whenever the status of a batch job changes.
import { BedrockClient, GetModelInvocationJobCommand } from '@aws-sdk/client-bedrock';
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { EventBridgeEvent } from 'aws-lambda';
import { jobIdFromArn, parseOutputLine, type LineResult } from './batch-records.js';

const s3 = new S3Client({});
const bedrock = new BedrockClient({});
const BUCKET = process.env.DATA_BUCKET!;

interface JobStateDetail {
  batchJobArn: string;
  batchJobName: string;
  status: string;
  failureMessage?: string;
}

export async function handler(event: EventBridgeEvent<'Batch Inference Job State Change', JobStateDetail>) {
  const { batchJobArn, batchJobName, status, failureMessage } = event.detail;

  if (status !== 'Completed' && status !== 'PartiallyCompleted') {
    console.error(JSON.stringify({ msg: 'Batch job without results', batchJobName, status, failureMessage }));
    return;
  }

  // Ask the job itself for its output location instead of guessing it.
  const job = await bedrock.send(new GetModelInvocationJobCommand({ jobIdentifier: batchJobArn }));
  const outputUri = job.outputDataConfig?.s3OutputDataConfig?.s3Uri ?? '';
  const outputPrefix = `${outputUri.replace(`s3://${BUCKET}/`, '').replace(/\/?$/, '/')}${jobIdFromArn(batchJobArn)}/`;

  const results: LineResult[] = [];
  const listing = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: outputPrefix }));
  for (const obj of listing.Contents ?? []) {
    if (!obj.Key?.endsWith('.jsonl.out')) continue;
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key }));
    const lines = (await res.Body!.transformToString()).split('\n').filter((l) => l.trim() !== '');
    results.push(...lines.map(parseOutputLine));
  }

  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: `results/${batchJobName}.json`,
      Body: JSON.stringify({ batchJobName, status, ok, failed }, null, 2),
      ContentType: 'application/json',
    }),
  );
  console.log(JSON.stringify({ msg: 'Results stored', batchJobName, ok: ok.length, failed: failed.length }));
}
