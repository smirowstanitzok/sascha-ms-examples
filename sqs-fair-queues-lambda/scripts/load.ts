// scripts/load.ts
// Usage: QUEUE_URL=... npx tsx scripts/load.ts
import { SQSClient } from '@aws-sdk/client-sqs';
import { enqueueJobs } from '../src/enqueue.js';
import type { ClubJob } from '../src/job.js';

const queueUrl = process.env.QUEUE_URL;
if (!queueUrl) throw new Error('Please set QUEUE_URL');

const client = new SQSClient({});
const jobs = (clubId: string, count: number): ClubJob[] =>
  Array.from({ length: count }, (_, i) => ({
    clubId, jobId: `${clubId}-${Date.now()}-${i}`, memberId: `m-${i}`, type: 'membership-card',
  }));

// One large import plus four small clubs
const all = [...jobs('tsv-gross', 5000), ...['sv-a', 'sv-b', 'sv-c', 'sv-d'].flatMap((c) => jobs(c, 50))];
const failed = await enqueueJobs(client, queueUrl, all);
console.log(`${all.length - failed} jobs queued, ${failed} failed`);
