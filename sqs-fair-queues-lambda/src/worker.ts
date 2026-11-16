// src/worker.ts
import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { parseClubJob, type ClubJob } from './job.js';

async function processJob(job: ClubJob): Promise<void> {
  // Placeholder for the real work, e.g. render a PDF or send an email
  await new Promise((resolve) => setTimeout(resolve, 50));
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    const started = Date.now();
    try {
      const job = parseClubJob(record.body);
      await processJob(job);
      // Structured log: basis for Contributor Insights (top clubs by load)
      console.log(JSON.stringify({
        msg: 'job-processed',
        clubId: job.clubId,
        jobType: job.type,
        durationMs: Date.now() - started,
        dwellMs: started - Number(record.attributes.SentTimestamp),
      }));
    } catch (err) {
      console.error(JSON.stringify({ msg: 'job-failed', messageId: record.messageId, error: String(err) }));
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
