// test/activity-worker.test.ts
import {
  GetActivityTaskCommand,
  SendTaskFailureCommand,
  SendTaskSuccessCommand,
  SFNClient,
  TaskTimedOut,
} from '@aws-sdk/client-sfn';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { ActivityWorker, type JobHandler } from '../src/activity-worker.js';
import { printContract } from '../src/print-contract.js';

const sfnMock = mockClient(SFNClient);
const options = {
  activityArn: 'arn:aws:states:eu-central-1:111122223333:activity:demo',
  workerName: 'test',
  pollers: 1,
  maxParallelJobs: 1,
  heartbeatMs: 60_000,
};

function runOnce(handler: JobHandler) {
  const worker = new ActivityWorker(new SFNClient({ region: 'eu-central-1' }), options, async (input, signal) => {
    worker.stop();
    return handler(input, signal);
  });
  return worker.run();
}

describe('ActivityWorker', () => {
  beforeEach(() => {
    sfnMock.reset();
    process.env.PRINT_DURATION_MS = '1';
  });

  it('reports the result with SendTaskSuccess', async () => {
    sfnMock.on(GetActivityTaskCommand).resolvesOnce({
      taskToken: 'token-1',
      input: JSON.stringify({ rentalId: 'r-42', customerName: 'Mia', bikeId: 'b-7' }),
    });
    sfnMock.on(SendTaskSuccessCommand).resolves({});

    await runOnce(printContract);

    const calls = sfnMock.commandCalls(SendTaskSuccessCommand);
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0].args[0].input.output!)).toMatchObject({ rentalId: 'r-42' });
  });

  it('reports invalid tasks with SendTaskFailure', async () => {
    sfnMock.on(GetActivityTaskCommand).resolvesOnce({
      taskToken: 'token-2',
      input: JSON.stringify({ rentalId: 'r-43' }),
    });
    sfnMock.on(SendTaskFailureCommand).resolves({});

    await runOnce(printContract);

    const calls = sfnMock.commandCalls(SendTaskFailureCommand);
    expect(calls[0].args[0].input).toMatchObject({ taskToken: 'token-2', error: 'InvalidPrintJob' });
  });

  it('silently discards the result when the token has expired', async () => {
    sfnMock.on(GetActivityTaskCommand).resolvesOnce({ taskToken: 'token-3', input: '{}' });
    sfnMock
      .on(SendTaskSuccessCommand)
      .rejects(new TaskTimedOut({ message: 'expired', $metadata: {} }));

    await runOnce(async () => ({ ok: true }));

    expect(sfnMock.commandCalls(SendTaskFailureCommand)).toHaveLength(0);
  });
});
