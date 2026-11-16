// src/enqueue.ts
import { SendMessageBatchCommand, type SQSClient, type SendMessageBatchRequestEntry } from '@aws-sdk/client-sqs';
import type { ClubJob } from './job.js';

const MAX_BATCH = 10; // SQS allows at most 10 messages per SendMessageBatch

/** Builds batch entries: the club ID becomes the MessageGroupId and thus the tenant identifier. */
export function toBatchEntries(jobs: ClubJob[]): SendMessageBatchRequestEntry[][] {
  const entries = jobs.map((job, i) => {
    if (!job.clubId.trim()) {
      throw new Error(`Job ${job.jobId} has no clubId – no tenant identifier, no fairness`);
    }
    return {
      Id: String(i),
      MessageBody: JSON.stringify(job),
      MessageGroupId: job.clubId,
    } satisfies SendMessageBatchRequestEntry;
  });

  const chunks: SendMessageBatchRequestEntry[][] = [];
  for (let i = 0; i < entries.length; i += MAX_BATCH) {
    chunks.push(entries.slice(i, i + MAX_BATCH).map((e, j) => ({ ...e, Id: String(j) })));
  }
  return chunks;
}

export async function enqueueJobs(client: SQSClient, queueUrl: string, jobs: ClubJob[]): Promise<number> {
  let failed = 0;
  for (const chunk of toBatchEntries(jobs)) {
    const res = await client.send(new SendMessageBatchCommand({ QueueUrl: queueUrl, Entries: chunk }));
    failed += res.Failed?.length ?? 0;
  }
  return failed;
}
