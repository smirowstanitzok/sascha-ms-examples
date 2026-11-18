// src/submit-batch.ts
// Runs every night: collects the previous day's reviews and starts a batch job.
import { BedrockClient, CreateModelInvocationJobCommand } from '@aws-sdk/client-bedrock';
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { runNameForDate, toJsonl, type Review } from './batch-records.js';

const s3 = new S3Client({});
const bedrock = new BedrockClient({});

const BUCKET = process.env.DATA_BUCKET!;
const MODEL_ID = process.env.MODEL_ID!;
const ROLE_ARN = process.env.BATCH_ROLE_ARN!;
const MIN_RECORDS = Number(process.env.MIN_RECORDS ?? '100');

async function loadReviews(prefix: string): Promise<Review[]> {
  const reviews: Review[] = [];
  let token: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }),
    );
    for (const obj of page.Contents ?? []) {
      const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key! }));
      reviews.push(JSON.parse(await res.Body!.transformToString()) as Review);
    }
    token = page.NextContinuationToken;
  } while (token);
  return reviews;
}

export async function handler(): Promise<{ status: string; runName: string; records: number }> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const runName = runNameForDate(yesterday);
  const day = yesterday.toISOString().slice(0, 10);

  const reviews = await loadReviews(`incoming/${day}/`);
  if (reviews.length < MIN_RECORDS) {
    console.log(JSON.stringify({ msg: 'Too few records, no job', runName, records: reviews.length }));
    return { status: 'skipped', runName, records: reviews.length };
  }

  const inputKey = `batch-input/${runName}/reviews.jsonl`;
  await s3.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: inputKey, Body: toJsonl(reviews), ContentType: 'application/jsonl' }),
  );

  const job = await bedrock.send(
    new CreateModelInvocationJobCommand({
      jobName: runName,
      clientRequestToken: runName, // the same run never starts a second job
      roleArn: ROLE_ARN,
      modelId: MODEL_ID,
      modelInvocationType: 'Converse',
      timeoutDurationInHours: 24,
      inputDataConfig: { s3InputDataConfig: { s3Uri: `s3://${BUCKET}/${inputKey}`, s3InputFormat: 'JSONL' } },
      outputDataConfig: { s3OutputDataConfig: { s3Uri: `s3://${BUCKET}/batch-output/` } },
    }),
  );

  console.log(JSON.stringify({ msg: 'Batch job started', runName, jobArn: job.jobArn, records: reviews.length }));
  return { status: 'submitted', runName, records: reviews.length };
}
