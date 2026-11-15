// src/main.ts
import { hostname } from 'node:os';
import { ActivityWorker, createSfnClient } from './activity-worker.js';
import { printContract } from './print-contract.js';

const activityArn = process.env.ACTIVITY_ARN;
if (!activityArn) {
  console.error('Please set ACTIVITY_ARN');
  process.exit(1);
}

const pollers = Number(process.env.POLLERS ?? 4);
const worker = new ActivityWorker(
  createSfnClient(process.env.AWS_REGION, pollers + 10),
  {
    activityArn,
    workerName: process.env.WORKER_NAME ?? hostname(),
    pollers,
    maxParallelJobs: Number(process.env.MAX_PARALLEL_JOBS ?? 2),
    heartbeatMs: 10_000,
  },
  printContract,
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    console.log(`${signal} received – open polls may take up to 60 s to finish`);
    worker.stop();
  });
}

console.log(`Worker started, ${pollers} pollers`);
await worker.run();
console.log('Worker stopped');
